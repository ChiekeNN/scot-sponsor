-- Apply after the new public_job_list-based frontend has deployed.
revoke select on public.partner_jobs, public.partner_job_sync_status from anon, authenticated;
revoke execute on function public.request_application_support(text,text,text,boolean) from authenticated;
