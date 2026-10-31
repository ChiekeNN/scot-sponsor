-- Correct the local variable name: CURRENT_TIME is a SQL keyword.
create or replace function public.save_scottish_job(p_job jsonb) returns text language plpgsql security definer set search_path='' as $$
declare j public.partner_jobs%rowtype; fp text; observed_time timestamptz:=clock_timestamp(); p_id text:=p_job->>'external_id';
 p_title text:=trim(p_job->>'title'); p_employer text:=trim(p_job->>'employer'); p_location text:=trim(p_job->>'location');
 p_desc text:=trim(p_job->>'description'); p_url text:=p_job->>'source_url'; p_excerpt text; p_posted timestamptz; p_expires timestamptz;
begin
 if p_id !~ '^\d{1,12}$' or length(p_title) not between 2 and 200 or length(p_employer) not between 2 and 200 or length(p_location) not between 2 and 200
 or length(p_desc) not between 120 and 30000 or p_desc ~ '(\.\.\.|…)$' or lower(p_desc) like '%adzuna%'
 or p_url !~ ('^https://myjobscotland[.]gov[.]uk/councils/[a-z0-9-]+/jobs/[a-z0-9-]+-'||p_id||'$') then return 'invalid'; end if;
 begin p_posted:=(p_job->>'posted_at')::timestamptz; p_expires:=(p_job->>'expires_at')::timestamptz; exception when others then return 'invalid'; end;
 if p_posted is null or p_posted>observed_time or p_posted<observed_time-interval '14 days' or p_expires is null or p_expires<=observed_time then return 'stale'; end if;
 p_excerpt:=left(regexp_replace(p_desc,'\s+',' ','g'),190);
 insert into public.partner_jobs(source,external_id,title,description,employer,location,location_search,posted_at,source_url,last_seen,expires_at)
 values('myjobscotland',p_id,p_title,p_excerpt,p_employer,p_location,concat_ws(', ',p_location,'Scotland'),p_posted,p_url,observed_time,p_expires)
 on conflict(source,external_id) do update set title=excluded.title,description=excluded.description,employer=excluded.employer,location=excluded.location,location_search=excluded.location_search,
 posted_at=excluded.posted_at,source_url=excluded.source_url,last_seen=excluded.last_seen,expires_at=excluded.expires_at returning * into j;
 fp:=public.job_listing_fingerprint(j.title,j.employer,j.location,j.description);
 if not exists(select 1 from public.partner_detail_exclusions where job_id=j.public_id and listing_fingerprint=fp) then
 insert into public.job_complete_descriptions(job_id,description,listing_fingerprint,updated_by,updated_at,origin)
 values(j.public_id,p_desc,fp,null,observed_time,'provider')
 on conflict(job_id) do update set description=excluded.description,listing_fingerprint=excluded.listing_fingerprint,updated_by=null,updated_at=excluded.updated_at,origin='provider'
 where public.job_complete_descriptions.origin='provider';
 end if;
 insert into public.partner_job_sync_status(source,last_success,last_attempt,last_error,count,truncated)
 values('myjobscotland',observed_time,observed_time,null,1,true)
 on conflict(source) do update set last_success=excluded.last_success,last_attempt=excluded.last_attempt,last_error=null,count=(select count(*) from public.partner_jobs where source='myjobscotland'),truncated=true;
 return 'saved';
end $$;
