create function public.admin_scotland_job_import_status() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare s public.scotland_job_import_state%rowtype;
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 select * into s from public.scotland_job_import_state where id=true;
 return jsonb_build_object('last_started',s.last_started,'last_finished',s.last_finished,'last_result',s.last_result,'blocked_until',s.blocked_until,'updates',s.imported);
end $$;
revoke all on function public.admin_scotland_job_import_status() from public,anon;
grant execute on function public.admin_scotland_job_import_status() to authenticated;
