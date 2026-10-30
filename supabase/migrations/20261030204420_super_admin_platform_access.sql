-- Access is based on a server-managed admin role or a current Job Hunt Pass.
-- Administrators do not need an expiring entitlement; ordinary members still do.
create function public.can_access_job_hunt() returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.is_super_admin() or public.has_job_hunt_pass();
$$;
revoke all on function public.can_access_job_hunt() from public, anon;
grant execute on function public.can_access_job_hunt() to authenticated;

alter policy "members read active directory metadata" on public.sponsor_directory_versions
  using (active and (select public.can_access_job_hunt()));
alter policy "members read active directory" on public.sponsor_directory
  using ((select public.can_access_job_hunt()) and exists (select 1 from public.sponsor_directory_versions v where v.id = version_id and v.active));
