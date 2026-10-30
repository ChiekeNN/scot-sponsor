-- Both active member plans and administrators can use official information tools.
-- This does not change Job Hunt-only access to the directory or company checks.
create function public.can_access_member_insights() returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_super_admin() or exists (
    select 1 from public.member_entitlements e
    where e.user_id = (select auth.uid()) and e.plan in ('job_hunt_pass','monthly_alert_pass')
      and e.starts_at <= now() and e.expires_at > now() and e.revoked_at is null
  );
$$;
revoke all on function public.can_access_member_insights() from public, anon;
grant execute on function public.can_access_member_insights() to authenticated;
