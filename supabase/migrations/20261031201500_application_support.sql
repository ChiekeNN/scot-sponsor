-- Private ScotSponsor support requests; no CVs or employer submissions.
create table public.application_support_requests (
 id uuid primary key default gen_random_uuid(), applicant_id uuid not null references auth.users(id) on delete cascade,
 applicant_name text not null, applicant_email text not null,
 job_source text not null, job_id text not null, job_title text not null, employer text not null, location text not null,
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 unique(applicant_id,job_source,job_id)
);
create index application_support_created on public.application_support_requests(created_at desc);
alter table public.application_support_requests enable row level security;
revoke all on public.application_support_requests from public, anon, authenticated;
grant all on public.application_support_requests to service_role;

create function public.request_application_support(p_source text,p_job_id text,p_name text,p_consent boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := auth.uid(); job public.partner_jobs%rowtype; account_email text; request_id uuid;
begin
 if uid is null or not public.can_access_job_hunt() then raise exception 'ACTIVE_PASS_REQUIRED' using errcode='42501'; end if;
 if p_consent is distinct from true then raise exception 'CONSENT_REQUIRED' using errcode='22023'; end if;
 if p_name is null or char_length(trim(p_name)) < 2 or char_length(trim(p_name)) > 120 then raise exception 'INVALID_NAME' using errcode='22023'; end if;
 select email into account_email from auth.users where id=uid and email_confirmed_at is not null;
 if account_email is null then raise exception 'VERIFIED_EMAIL_REQUIRED' using errcode='42501'; end if;
 select j.* into job from public.partner_jobs j join public.partner_job_sync_status s on s.source=j.source
 where j.source=p_source and j.external_id=p_job_id and j.posted_at >= now()-interval '14 days' and j.posted_at <= now()
 and j.last_seen >= now()-interval '5 days' and s.last_success is not null and j.last_seen <= s.last_success;
 if not found then raise exception 'JOB_UNAVAILABLE' using errcode='22023'; end if;
 if exists(select 1 from public.application_support_requests where applicant_id=uid and job_source=p_source and job_id=p_job_id) then raise exception 'ALREADY_REQUESTED' using errcode='23505'; end if;
 if (select count(*) from public.application_support_requests where applicant_id=uid and created_at > now()-interval '24 hours') >= 10 then raise exception 'DAILY_LIMIT' using errcode='22023'; end if;
 insert into public.application_support_requests(applicant_id,applicant_name,applicant_email,job_source,job_id,job_title,employer,location)
 values(uid,trim(p_name),account_email,job.source,job.external_id,job.title,job.employer,job.location) returning id into request_id;
 return request_id;
end; $$;
revoke all on function public.request_application_support(text,text,text,boolean) from public, anon;
grant execute on function public.request_application_support(text,text,text,boolean) to authenticated;

create function public.admin_application_support_requests()
returns table(id uuid,applicant_name text,applicant_email text,job_title text,employer text,location text,created_at timestamptz,reviewed_at timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 return query select r.id,r.applicant_name,r.applicant_email,r.job_title,r.employer,r.location,r.created_at,r.reviewed_at
 from public.application_support_requests r where r.created_at >= now()-interval '90 days' order by r.created_at desc limit 200;
end; $$;
revoke all on function public.admin_application_support_requests() from public, anon;
grant execute on function public.admin_application_support_requests() to authenticated;

create function public.admin_review_application_support(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 update public.application_support_requests set reviewed_at=coalesce(reviewed_at,now()) where id=p_id and created_at >= now()-interval '90 days';
 if not found then raise exception 'REQUEST_NOT_FOUND' using errcode='22023'; end if;
end; $$;
revoke all on function public.admin_review_application_support(uuid) from public, anon;
grant execute on function public.admin_review_application_support(uuid) to authenticated;

-- Database-enforced retention; the cron owner has the table privileges needed for this purge.
select cron.schedule('scotsponsor-application-support-retention','15 3 * * *', $purge$delete from public.application_support_requests where created_at < now()-interval '90 days'$purge$);
