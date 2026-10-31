-- Retire Reed and its candidates; dependent descriptions and attempts cascade.
-- Historical private application-support requests are deliberately retained.
delete from public.partner_jobs where source='reed';
delete from public.partner_job_sync_status where source='reed';
delete from public.partner_detail_import_control where source='reed';
alter table public.partner_jobs drop constraint partner_jobs_source_check;
alter table public.partner_jobs add constraint partner_jobs_source_check check (source in ('myjobscotland'));
alter table public.partner_job_sync_status drop constraint partner_job_sync_status_source_check;
alter table public.partner_job_sync_status add constraint partner_job_sync_status_source_check check (source in ('myjobscotland'));
drop function if exists public.block_reed_detail_import(integer);
drop function if exists public.claim_reed_detail_jobs(integer);
drop function if exists public.save_reed_job_detail(uuid,text,text,text,text,text,text,timestamptz,numeric,numeric,text,text,text);

-- Include the original URL for attribution, current information and attachments.
create or replace function public.public_job_detail(p_job_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',j.public_id,'title',j.title,'employer',j.employer,'location',j.location,'posted_at',j.posted_at,'expires_at',j.expires_at,
  'excerpt',j.description,'full_description',d.description,'salary_min',j.salary_min,'salary_max',j.salary_max,'salary_is_predicted',j.salary_is_predicted,'salary_period',j.salary_period,'contract_type',j.contract_type,'contract_time',j.contract_time,
  'source_url',case when j.source='myjobscotland' and j.source_url ~ '^https://myjobscotland[.]gov[.]uk/' then j.source_url else null end)
 from public.partner_jobs j join public.partner_job_sync_status s on s.source=j.source
 join public.job_complete_descriptions d on d.job_id=j.public_id
 where j.public_id=p_job_id and j.posted_at>=now()-interval '14 days' and j.posted_at<=now()
 and j.last_seen>=now()-interval '5 days' and s.last_success is not null and j.last_seen<=s.last_success
 and (j.expires_at is null or j.expires_at>now()) and concat_ws(' ',j.title,j.description,j.employer,j.location) not ilike '%adzuna%'
 and d.listing_fingerprint=public.job_listing_fingerprint(j.title,j.employer,j.location,j.description)
 and (d.origin='manual' or d.updated_at>=now()-interval '7 days');
$$;
