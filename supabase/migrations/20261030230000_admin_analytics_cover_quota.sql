-- Aggregate complete, current account data for super admins only. No revenue inference.
create function public.admin_platform_analytics() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
 if not public.is_super_admin() then raise exception 'Not authorised' using errcode='42501'; end if;
 select jsonb_build_object(
  'as_of', now(),
  'accounts', (select jsonb_build_object('total',count(*),'confirmed',count(*) filter(where email_confirmed_at is not null),'new_30_days',count(*) filter(where created_at >= now()-interval '30 days')) from auth.users),
  'plans', (select jsonb_agg(jsonb_build_object('plan',p.plan,'active',p.active,'expired',p.expired,'revoked',p.revoked,'scheduled',p.scheduled,'expiring_30_days',p.expiring) order by p.plan) from (
    select names.plan, count(e.user_id) filter(where e.revoked_at is null and e.starts_at <= now() and e.expires_at > now()) as active,
      count(e.user_id) filter(where e.revoked_at is null and e.expires_at <= now()) as expired,
      count(e.user_id) filter(where e.revoked_at is not null) as revoked,
      count(e.user_id) filter(where e.revoked_at is null and e.starts_at > now()) as scheduled,
      count(e.user_id) filter(where e.revoked_at is null and e.starts_at <= now() and e.expires_at > now() and e.expires_at <= now()+interval '30 days') as expiring
    from (values ('monthly_alert_pass'),('job_hunt_pass')) as names(plan)
    left join public.member_entitlements e on e.plan=names.plan group by names.plan
   ) p),
  'active_people', (select count(distinct e.user_id) from public.member_entitlements e where e.revoked_at is null and e.starts_at <= now() and e.expires_at > now()),
  'grants_30_days', (select count(*) from public.admin_audit_log where action='grant' and occurred_at >= now()-interval '30 days'),
  'directory', (select jsonb_build_object('source_label',v.source_label,'source_date',v.source_date,'uploaded_at',v.uploaded_at,
    'rows',(select count(*) from public.sponsor_directory s where s.version_id=v.id),
    'towns',(select count(distinct s.city_town) from public.sponsor_directory s where s.version_id=v.id),
    'industries',(select coalesce(jsonb_agg(jsonb_build_object('name',x.name,'count',x.n) order by x.n desc,x.name),'[]'::jsonb) from (select industry_sector as name,count(*) as n from public.sponsor_directory s where s.version_id=v.id and industry_sector<>'' group by industry_sector order by count(*) desc,industry_sector limit 6) x),
    'locations',(select coalesce(jsonb_agg(jsonb_build_object('name',x.name,'count',x.n) order by x.n desc,x.name),'[]'::jsonb) from (select city_town as name,count(*) as n from public.sponsor_directory s where s.version_id=v.id and city_town<>'' group by city_town order by count(*) desc,city_town limit 6) x)) from public.sponsor_directory_versions v where v.active limit 1)
 ) into result;
 return result;
end $$;
revoke all on function public.admin_platform_analytics() from public, anon;
grant execute on function public.admin_platform_analytics() to authenticated;

-- Atomic per-account usage cap for chargeable AI requests; no letter content stored.
create table public.cover_letter_usage (user_id uuid not null references auth.users(id) on delete cascade, usage_day date not null, attempts integer not null, primary key(user_id,usage_day));
alter table public.cover_letter_usage enable row level security;
revoke all on public.cover_letter_usage from public, anon, authenticated;
grant all on public.cover_letter_usage to service_role;
create function public.consume_cover_letter_attempt() returns boolean
language plpgsql security definer set search_path = '' as $$
declare used integer;
begin
 if not public.can_access_job_hunt() then raise exception 'Not authorised' using errcode='42501'; end if;
 if public.is_super_admin() then return true; end if;
 delete from public.cover_letter_usage where user_id=(select auth.uid()) and usage_day < (now() at time zone 'UTC')::date-30;
 insert into public.cover_letter_usage(user_id,usage_day,attempts) values ((select auth.uid()),(now() at time zone 'UTC')::date,1)
 on conflict (user_id,usage_day) do update set attempts=public.cover_letter_usage.attempts+1 where public.cover_letter_usage.attempts < 10
 returning attempts into used;
 return used is not null;
end $$;
revoke all on function public.consume_cover_letter_attempt() from public, anon;
grant execute on function public.consume_cover_letter_attempt() to authenticated;
