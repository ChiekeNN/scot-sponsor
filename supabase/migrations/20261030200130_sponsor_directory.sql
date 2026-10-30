-- Sponsor directory: default-deny access, enforced in Postgres rather than in the UI.
-- Apply only to the approved ScotSponsor Supabase project.
create table if not exists public.member_entitlements (
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan = 'job_hunt_pass'),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  primary key (user_id, plan),
  check (expires_at > starts_at)
);

create table if not exists public.sponsor_directory_versions (
  id uuid primary key default gen_random_uuid(),
  source_label text not null,
  source_date date,
  record_count integer not null check (record_count > 0),
  active boolean not null default false,
  uploaded_at timestamptz not null default now(),
  activated_at timestamptz
);
create unique index if not exists sponsor_directory_one_active on public.sponsor_directory_versions ((active)) where active;

create table if not exists public.sponsor_directory (
  id bigint generated always as identity primary key,
  version_id uuid not null references public.sponsor_directory_versions(id) on delete cascade,
  source_row integer not null check (source_row > 0),
  organisation_name text not null,
  city_town text not null,
  county_region text not null,
  industry_sector text not null,
  visa_route text not null,
  licence_rating text not null,
  unique (version_id, source_row)
);
create index if not exists sponsor_directory_name_idx on public.sponsor_directory (organisation_name, id);
create index if not exists sponsor_directory_filter_idx on public.sponsor_directory (version_id, industry_sector, city_town);

alter table public.member_entitlements enable row level security;
alter table public.sponsor_directory_versions enable row level security;
alter table public.sponsor_directory enable row level security;
revoke all on public.member_entitlements, public.sponsor_directory_versions, public.sponsor_directory from public, anon, authenticated;
grant select on public.member_entitlements, public.sponsor_directory_versions, public.sponsor_directory to authenticated;
grant all on public.member_entitlements, public.sponsor_directory_versions, public.sponsor_directory to service_role;
grant usage, select on sequence public.sponsor_directory_id_seq to service_role;

-- Only the current user's entitlement is observable; no client can grant access.
create policy "read own entitlements" on public.member_entitlements for select to authenticated using (user_id = (select auth.uid()));
create function public.has_job_hunt_pass() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.member_entitlements e
    where e.user_id = (select auth.uid()) and e.plan = 'job_hunt_pass'
      and e.starts_at <= now() and e.expires_at > now() and e.revoked_at is null
  );
$$;
revoke all on function public.has_job_hunt_pass() from public, anon;
grant execute on function public.has_job_hunt_pass() to authenticated;

create policy "members read active directory metadata" on public.sponsor_directory_versions for select to authenticated
  using (active and (select public.has_job_hunt_pass()));
create policy "members read active directory" on public.sponsor_directory for select to authenticated
  using ((select public.has_job_hunt_pass()) and exists (select 1 from public.sponsor_directory_versions v where v.id = version_id and v.active));

-- Executes with the caller's permissions, so RLS still controls every row.
create function public.sponsor_directory_facets() returns jsonb
language sql stable security invoker set search_path = ''
as $$
  select jsonb_build_object(
    'industries', coalesce((select jsonb_agg(v order by v) from (select distinct industry_sector as v from public.sponsor_directory where industry_sector <> '') s), '[]'::jsonb),
    'locations', coalesce((select jsonb_agg(v order by v) from (select distinct city_town as v from public.sponsor_directory where city_town <> '') s), '[]'::jsonb),
    'routes', coalesce((select jsonb_agg(v order by v) from (select distinct visa_route as v from public.sponsor_directory where visa_route <> '') s), '[]'::jsonb)
  );
$$;
revoke all on function public.sponsor_directory_facets() from public, anon;
grant execute on function public.sponsor_directory_facets() to authenticated;

-- Importers stage all rows first; publication is a single transaction and only service_role can call it.
create function public.activate_sponsor_directory(p_version uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
declare expected integer; actual bigint;
begin
  perform pg_advisory_xact_lock(742634119);
  select record_count into expected from public.sponsor_directory_versions where id = p_version for update;
  if expected is null then raise exception 'Directory version not found'; end if;
  select count(*) into actual from public.sponsor_directory where version_id = p_version;
  if actual <> expected then raise exception 'Directory import incomplete: expected %, got %', expected, actual; end if;
  update public.sponsor_directory_versions set active = false where active;
  update public.sponsor_directory_versions set active = true, activated_at = now() where id = p_version;
end;
$$;
revoke all on function public.activate_sponsor_directory(uuid) from public, anon, authenticated;
grant execute on function public.activate_sponsor_directory(uuid) to service_role;
