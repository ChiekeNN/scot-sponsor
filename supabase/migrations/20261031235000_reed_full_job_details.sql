-- Provider details remain separately identified from manually reviewed descriptions.
alter table public.job_complete_descriptions alter column updated_by drop not null;
alter table public.job_complete_descriptions add column origin text not null default 'manual' check(origin in ('manual','provider'));
alter table public.job_complete_descriptions add constraint manual_description_has_editor check(origin <> 'manual' or updated_by is not null);
alter table public.partner_jobs add column expires_at timestamptz, add column salary_period text;
create table public.partner_detail_attempts(job_id uuid primary key references public.partner_jobs(public_id) on delete cascade,last_attempt timestamptz not null);
alter table public.partner_detail_attempts enable row level security;
revoke all on public.partner_detail_attempts from public, anon, authenticated;
grant all on public.partner_detail_attempts to service_role;

-- Respect an administrator's removal until the underlying listing changes.
create table public.partner_detail_exclusions(job_id uuid primary key references public.partner_jobs(public_id) on delete cascade,listing_fingerprint text not null);
alter table public.partner_detail_exclusions enable row level security;
revoke all on public.partner_detail_exclusions from public, anon, authenticated;
grant all on public.partner_detail_exclusions to service_role;
create or replace function public.admin_clear_job_full_description(p_job_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 insert into public.partner_detail_exclusions(job_id,listing_fingerprint)
 select j.public_id,public.job_listing_fingerprint(j.title,j.employer,j.location,j.description) from public.partner_jobs j where j.public_id=p_job_id
 on conflict(job_id) do update set listing_fingerprint=excluded.listing_fingerprint;
 delete from public.job_complete_descriptions where job_id=p_job_id;
end; $$;

-- A provider rate limit applies across cron runs and manual runs.
create table public.partner_detail_import_control(source text primary key,blocked_until timestamptz not null);
alter table public.partner_detail_import_control enable row level security;
revoke all on public.partner_detail_import_control from public, anon, authenticated;
grant all on public.partner_detail_import_control to service_role;
create function public.block_reed_detail_import(p_seconds integer) returns void language sql security definer set search_path='' as $$
 insert into public.partner_detail_import_control(source,blocked_until) values('reed',now()+greatest(coalesce(p_seconds,1800),1800)*interval '1 second')
 on conflict(source) do update set blocked_until=greatest(public.partner_detail_import_control.blocked_until,excluded.blocked_until);
$$;
revoke all on function public.block_reed_detail_import(integer) from public, anon, authenticated;
grant execute on function public.block_reed_detail_import(integer) to service_role;

-- Reserve a bounded set of candidates atomically; failed records are retried after a cooldown.
create function public.claim_reed_detail_jobs(p_limit integer default 20)
returns table(id uuid,external_id text,listing_fingerprint text) language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.partner_detail_import_control where source='reed' and blocked_until>now()) then raise exception 'PROVIDER_RATE_LIMITED'; end if;
 return query with candidates as (
  select j.public_id from public.partner_jobs j join public.partner_job_sync_status s on s.source=j.source
  left join public.job_complete_descriptions d on d.job_id=j.public_id
  left join public.partner_detail_attempts a on a.job_id=j.public_id
  left join public.partner_detail_exclusions x on x.job_id=j.public_id
  where j.source='reed' and j.posted_at >= now()-interval '14 days' and j.posted_at <= now()
   and j.last_seen >= now()-interval '5 days' and s.last_success is not null and j.last_seen <= s.last_success
   and (x.job_id is null or x.listing_fingerprint<>public.job_listing_fingerprint(j.title,j.employer,j.location,j.description))
   and (d.job_id is null or (d.origin='provider' and (d.listing_fingerprint<>public.job_listing_fingerprint(j.title,j.employer,j.location,j.description) or d.updated_at<now()-interval '24 hours')))
   and (a.last_attempt is null or a.last_attempt < now()-interval '6 hours')
  order by coalesce(a.last_attempt,'-infinity'::timestamptz),j.posted_at desc,j.public_id
  limit least(greatest(coalesce(p_limit,20),1),30) for update of j skip locked
 ), claimed as (
  insert into public.partner_detail_attempts(job_id,last_attempt) select public_id,now() from candidates
  on conflict(job_id) do update set last_attempt=excluded.last_attempt returning job_id
 ) select j.public_id,j.external_id,public.job_listing_fingerprint(j.title,j.employer,j.location,j.description) from public.partner_jobs j join claimed c on c.job_id=j.public_id;
end; $$;
revoke all on function public.claim_reed_detail_jobs(integer) from public, anon, authenticated;
grant execute on function public.claim_reed_detail_jobs(integer) to service_role;

-- Only exact source-ID, title, employer and location matches can enrich a listing.
create function public.save_reed_job_detail(p_job_id uuid,p_external_id text,p_fingerprint text,p_title text,p_employer text,p_location text,p_description text,p_expires_at timestamptz,p_salary_min numeric,p_salary_max numeric,p_salary_period text,p_contract_type text,p_contract_time text)
returns text language plpgsql security definer set search_path='' as $$
declare j public.partner_jobs%rowtype; changed integer;
begin
 select * into j from public.partner_jobs where public_id=p_job_id and source='reed' and external_id=p_external_id for update;
 if not found or p_fingerprint is distinct from public.job_listing_fingerprint(j.title,j.employer,j.location,j.description) then return 'mismatch'; end if;
 if exists(select 1 from public.partner_detail_exclusions where job_id=p_job_id and listing_fingerprint=p_fingerprint) then return 'manual_preserved'; end if;
 if lower(regexp_replace(trim(coalesce(p_title,'')),'\s+',' ','g'))<>lower(regexp_replace(trim(j.title),'\s+',' ','g'))
 or lower(regexp_replace(trim(coalesce(p_employer,'')),'\s+',' ','g'))<>lower(regexp_replace(trim(coalesce(j.employer,'')),'\s+',' ','g'))
 or lower(regexp_replace(trim(coalesce(p_location,'')),'\s+',' ','g'))<>lower(regexp_replace(trim(j.location),'\s+',' ','g')) then return 'mismatch'; end if;
 if p_description is null or char_length(trim(p_description)) not between 20 and 30000 or position('adzuna' in lower(p_description))>0 then return 'invalid'; end if;
 if trim(p_description)=trim(j.description) and trim(p_description) ~ '(\.\.\.|…)$' then return 'invalid'; end if;
 if p_salary_min is not null and (p_salary_min<0 or p_salary_min>1000000000) then return 'invalid'; end if;
 if p_salary_max is not null and (p_salary_max<0 or p_salary_max>1000000000) then return 'invalid'; end if;
 if p_salary_period is not null and p_salary_period not in ('hour','day','week','month','year') then return 'invalid'; end if;
 if p_contract_type is not null and p_contract_type not in ('permanent','contract','temporary') then return 'invalid'; end if;
 if p_contract_time is not null and p_contract_time not in ('full_time','part_time') then return 'invalid'; end if;
 update public.partner_jobs set expires_at=coalesce(p_expires_at,expires_at), salary_min=coalesce(p_salary_min,salary_min),salary_max=coalesce(p_salary_max,salary_max),salary_period=coalesce(p_salary_period,salary_period),contract_type=coalesce(p_contract_type,contract_type),contract_time=coalesce(p_contract_time,contract_time) where public_id=j.public_id;
 if coalesce(p_expires_at,j.expires_at) <= now() then return 'expired'; end if;
 insert into public.job_complete_descriptions(job_id,description,listing_fingerprint,updated_by,updated_at,origin)
 values(j.public_id,trim(p_description),public.job_listing_fingerprint(j.title,j.employer,j.location,j.description),null,now(),'provider')
 on conflict(job_id) do update set description=excluded.description,listing_fingerprint=excluded.listing_fingerprint,updated_at=excluded.updated_at,updated_by=null,origin='provider'
 where public.job_complete_descriptions.origin='provider';
 get diagnostics changed = row_count;
 if changed=0 then return 'manual_preserved'; end if;
 return 'saved';
end; $$;
revoke all on function public.save_reed_job_detail(uuid,text,text,text,text,text,text,timestamptz,numeric,numeric,text,text,text) from public, anon, authenticated;
grant execute on function public.save_reed_job_detail(uuid,text,text,text,text,text,text,timestamptz,numeric,numeric,text,text,text) to service_role;

-- Do not display expired vacancies; older provider-fetched full texts expire rather than being presented as current.
create or replace function public.public_job_list(p_offset integer default 0,p_limit integer default 1000)
returns table(id uuid,title text,description text,employer text,location text,posted_at timestamptz)
language sql stable security definer set search_path='' as $$
 select j.public_id,j.title,j.description,j.employer,j.location,j.posted_at
 from public.partner_jobs j join public.partner_job_sync_status s on s.source=j.source
 where j.posted_at >= now()-interval '14 days' and j.posted_at <= now()
 and j.last_seen >= now()-interval '5 days' and s.last_success is not null and j.last_seen <= s.last_success
 and (j.expires_at is null or j.expires_at>now())
 and concat_ws(' ',j.title,j.description,j.employer,j.location) not ilike '%adzuna%'
 order by j.posted_at desc,j.public_id asc offset greatest(coalesce(p_offset,0),0) limit least(greatest(coalesce(p_limit,1000),1),1000);
$$;
create or replace function public.public_job_detail(p_job_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',j.public_id,'title',j.title,'employer',j.employer,'location',j.location,'posted_at',j.posted_at,'expires_at',j.expires_at,
  'excerpt',j.description,'full_description',case when d.listing_fingerprint=public.job_listing_fingerprint(j.title,j.employer,j.location,j.description) and (d.origin='manual' or d.updated_at>=now()-interval '7 days') then d.description else null end,
  'salary_min',j.salary_min,'salary_max',j.salary_max,'salary_is_predicted',j.salary_is_predicted,'salary_period',j.salary_period,'contract_type',j.contract_type,'contract_time',j.contract_time)
 from public.partner_jobs j join public.partner_job_sync_status s on s.source=j.source left join public.job_complete_descriptions d on d.job_id=j.public_id
 where j.public_id=p_job_id and j.posted_at >= now()-interval '14 days' and j.posted_at <= now()
 and j.last_seen >= now()-interval '5 days' and s.last_success is not null and j.last_seen <= s.last_success
 and (j.expires_at is null or j.expires_at>now()) and concat_ws(' ',j.title,j.description,j.employer,j.location) not ilike '%adzuna%';
$$;

-- An admin edit takes ownership of a provider-imported description and must never be overwritten by the importer.
create or replace function public.admin_save_job_full_description(p_job_id uuid,p_description text,p_confirm boolean) returns void language plpgsql security definer set search_path='' as $$
declare j public.partner_jobs%rowtype;
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_confirm is distinct from true then raise exception 'CONFIRMATION_REQUIRED' using errcode='22023'; end if;
 if p_description is null or char_length(trim(p_description)) not between 20 and 30000 or position('adzuna' in lower(p_description))>0 then raise exception 'INVALID_DESCRIPTION' using errcode='22023'; end if;
 select * into j from public.partner_jobs where public_id=p_job_id for update;
 if not found or public.public_job_detail(p_job_id) is null then raise exception 'JOB_UNAVAILABLE' using errcode='22023'; end if;
 insert into public.job_complete_descriptions(job_id,description,listing_fingerprint,updated_by,updated_at,origin)
 values(j.public_id,trim(p_description),public.job_listing_fingerprint(j.title,j.employer,j.location,j.description),auth.uid(),now(),'manual')
 on conflict(job_id) do update set description=excluded.description,listing_fingerprint=excluded.listing_fingerprint,updated_by=excluded.updated_by,updated_at=excluded.updated_at,origin='manual';
end; $$;
