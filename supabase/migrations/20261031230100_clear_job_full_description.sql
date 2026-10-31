create function public.admin_clear_job_full_description(p_job_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 delete from public.job_complete_descriptions where job_id=p_job_id;
end; $$;
revoke all on function public.admin_clear_job_full_description(uuid) from public, anon;
grant execute on function public.admin_clear_job_full_description(uuid) to authenticated;
