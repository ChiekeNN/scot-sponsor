-- Preserve the existing listing and request records while issuing opaque public job identifiers.
alter table public.partner_jobs add column public_id uuid not null default gen_random_uuid();
create unique index partner_jobs_public_id on public.partner_jobs(public_id);
alter table public.application_support_requests add column support_notes text not null default '' check (char_length(support_notes)<=2000);

-- No upstream identifiers, provider names or outbound URLs are returned to applicants.
create function public.public_job_list(p_offset integer default 0,p_limit integer default 1000)
returns table(id uuid,title text,description text,employer text,location text,posted_at timestamptz)
language sql stable security definer set search_path='' as $$
 select j.public_id,j.title,j.description,j.employer,j.location,j.posted_at
 from public.partner_jobs j join public.partner_job_sync_status s on s.source=j.source
 where j.posted_at >= now()-interval '14 days' and j.posted_at <= now()
 and j.last_seen >= now()-interval '5 days' and s.last_success is not null and j.last_seen <= s.last_success
 order by j.posted_at desc,j.public_id asc offset greatest(coalesce(p_offset,0),0) limit least(greatest(coalesce(p_limit,1000),1),1000);
$$;
revoke all on function public.public_job_list(integer,integer) from public;
grant execute on function public.public_job_list(integer,integer) to anon, authenticated;

create function public.request_application_support_for_job(p_job_id uuid,p_name text,p_consent boolean,p_notes text default '')
returns uuid language plpgsql security definer set search_path='' as $$
declare source_name text; external_id text; result_id uuid;
begin
 if char_length(coalesce(p_notes,''))>2000 then raise exception 'NOTES_TOO_LONG' using errcode='22023'; end if;
 select j.source,j.external_id into source_name,external_id from public.partner_jobs j where j.public_id=p_job_id;
 if source_name is null then raise exception 'JOB_UNAVAILABLE' using errcode='22023'; end if;
 result_id:=public.request_application_support(source_name,external_id,p_name,p_consent);
 update public.application_support_requests set support_notes=trim(coalesce(p_notes,'')) where id=result_id;
 return result_id;
end; $$;
revoke all on function public.request_application_support_for_job(uuid,text,boolean,text) from public, anon;
grant execute on function public.request_application_support_for_job(uuid,text,boolean,text) to authenticated;

create function public.admin_application_support_requests_v2()
returns table(id uuid,applicant_name text,applicant_email text,job_title text,employer text,location text,created_at timestamptz,reviewed_at timestamptz,support_notes text)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 return query select r.id,r.applicant_name,r.applicant_email,r.job_title,r.employer,r.location,r.created_at,r.reviewed_at,r.support_notes
 from public.application_support_requests r where r.created_at >= now()-interval '90 days' order by (r.reviewed_at is not null),r.created_at asc limit 200;
end; $$;
revoke all on function public.admin_application_support_requests_v2() from public, anon;
grant execute on function public.admin_application_support_requests_v2() to authenticated;

create function public.admin_job_feed_status()
returns table(feed text,last_success timestamptz,last_attempt timestamptz,last_error text,truncated boolean,count integer)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 return query select case when s.source='adzuna' then 'Primary feed' else 'Secondary feed' end,s.last_success,s.last_attempt,s.last_error,s.truncated,s.count from public.partner_job_sync_status s order by s.source;
end; $$;
revoke all on function public.admin_job_feed_status() from public, anon;
grant execute on function public.admin_job_feed_status() to authenticated;
