-- Membership and admin operations are authorised in Postgres, never by the client.
alter table public.member_entitlements drop constraint member_entitlements_plan_check;
alter table public.member_entitlements add constraint member_entitlements_plan_check check (plan in ('job_hunt_pass', 'monthly_alert_pass'));

create table public.super_admins (user_id uuid primary key references auth.users(id) on delete cascade, granted_at timestamptz not null default now());
create table public.super_admin_bootstrap (id boolean primary key default true check (id), target_email text not null, claimed_at timestamptz);
create table public.admin_audit_log (id bigint generated always as identity primary key, actor_id uuid not null, subject_id uuid not null, plan text not null, action text not null, expires_at timestamptz, occurred_at timestamptz not null default now());
alter table public.super_admins enable row level security;
alter table public.super_admin_bootstrap enable row level security;
alter table public.admin_audit_log enable row level security;
revoke all on public.super_admins, public.super_admin_bootstrap, public.admin_audit_log from public, anon, authenticated;
grant all on public.super_admins, public.super_admin_bootstrap, public.admin_audit_log to service_role;
grant usage, select on sequence public.admin_audit_log_id_seq to service_role;

create function public.is_super_admin() returns boolean language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.super_admins where user_id = (select auth.uid()));
$$;
revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

-- Claim only a single pre-authorised email and only after Supabase confirms it.
create function public.claim_initial_super_admin() returns trigger language plpgsql security definer set search_path = '' as $$
begin
 if new.email_confirmed_at is not null and new.email is not null then
   update public.super_admin_bootstrap set claimed_at = now() where id and claimed_at is null and lower(target_email) = lower(new.email);
   if found then insert into public.super_admins(user_id) values (new.id) on conflict do nothing; end if;
 end if;
 return new;
end;
$$;
revoke all on function public.claim_initial_super_admin() from public, anon, authenticated;
create trigger scotsponsor_claim_initial_admin after insert or update of email_confirmed_at on auth.users for each row execute function public.claim_initial_super_admin();

-- One-time bootstrap is callable only by a trusted project operator, never a member.
create function public.configure_initial_super_admin(p_email text) returns void language plpgsql security definer set search_path = '' as $$
declare target uuid;
begin
 if p_email is null or length(p_email) > 254 or p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then raise exception 'Invalid email'; end if;
 if exists (select 1 from public.super_admins) or exists (select 1 from public.super_admin_bootstrap) then raise exception 'Administrator bootstrap already configured'; end if;
 insert into public.super_admin_bootstrap (id,target_email) values (true, lower(p_email));
 select id into target from auth.users where lower(email) = lower(p_email) and email_confirmed_at is not null;
 if target is not null then
   update public.super_admin_bootstrap set claimed_at = now() where id;
   insert into public.super_admins(user_id) values (target);
 end if;
end;
$$;
revoke all on function public.configure_initial_super_admin(text) from public, anon, authenticated;
grant execute on function public.configure_initial_super_admin(text) to service_role;

create function public.admin_members() returns table(user_id uuid, email text, email_confirmed boolean, created_at timestamptz, plan text, starts_at timestamptz, expires_at timestamptz, revoked_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
 if not public.is_super_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
 return query select u.id, u.email::text, u.email_confirmed_at is not null, u.created_at, e.plan, e.starts_at, e.expires_at, e.revoked_at
 from auth.users u left join public.member_entitlements e on e.user_id = u.id order by u.created_at desc limit 1000;
end;
$$;
revoke all on function public.admin_members() from public, anon;
grant execute on function public.admin_members() to authenticated;

create function public.admin_set_pass(p_user uuid, p_plan text, p_expires_at timestamptz, p_action text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_super_admin() then raise exception 'Not authorised' using errcode = '42501'; end if;
 if p_plan not in ('job_hunt_pass','monthly_alert_pass') or p_action not in ('grant','revoke') then raise exception 'Invalid request'; end if;
 if not exists (select 1 from auth.users where id = p_user and email_confirmed_at is not null) then raise exception 'A verified user is required'; end if;
 if p_action = 'grant' then
   if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '2 years' then raise exception 'Invalid expiry date'; end if;
   insert into public.member_entitlements(user_id,plan,starts_at,expires_at,revoked_at) values(p_user,p_plan,now(),p_expires_at,null)
   on conflict(user_id,plan) do update set starts_at=excluded.starts_at, expires_at=excluded.expires_at, revoked_at=null;
 else
   update public.member_entitlements set revoked_at = now() where user_id = p_user and plan = p_plan and revoked_at is null;
   if not found then raise exception 'No active entitlement to revoke'; end if;
 end if;
 insert into public.admin_audit_log(actor_id,subject_id,plan,action,expires_at) values(auth.uid(),p_user,p_plan,p_action,case when p_action='grant' then p_expires_at else null end);
end;
$$;
revoke all on function public.admin_set_pass(uuid,text,timestamptz,text) from public, anon;
grant execute on function public.admin_set_pass(uuid,text,timestamptz,text) to authenticated;
