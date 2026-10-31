-- Retire the provider and prevent an older deployment from re-importing its jobs.
-- Job descriptions, exclusions and detail attempts cascade with the deleted jobs.
-- Historical private application-support requests are deliberately retained.
delete from public.partner_jobs where source='adzuna';
delete from public.partner_job_sync_status where source='adzuna';
delete from public.partner_detail_import_control where source='adzuna';
alter table public.partner_jobs drop constraint partner_jobs_source_check;
alter table public.partner_jobs add constraint partner_jobs_source_check check (source in ('reed'));
alter table public.partner_job_sync_status drop constraint partner_job_sync_status_source_check;
alter table public.partner_job_sync_status add constraint partner_job_sync_status_source_check check (source in ('reed'));
drop function if exists public.import_adzuna_full_description(uuid,text,text,text,text,text,text,timestamptz);

create or replace function public.admin_job_feed_status()
returns table(feed text,last_success timestamptz,last_attempt timestamptz,last_error text,truncated boolean,count integer)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 return query select 'Jobs feed'::text,s.last_success,s.last_attempt,s.last_error,s.truncated,s.count from public.partner_job_sync_status s where s.source='reed';
end; $$;
