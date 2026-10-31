-- Applications and CVs remain in one private row, so deletion removes both.
create table public.platform_job_applications (
 id uuid primary key default gen_random_uuid(),
 applicant_id uuid not null references auth.users(id) on delete cascade,
 job_id uuid not null,
 job_title text not null, employer text not null, location text not null,
 applicant_name text not null, applicant_email text not null, cover_note text not null default '',
 cv_name text not null, cv_type text not null, cv_bytes bytea not null,
 status text not null default 'active' check (status in ('active','suspended')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(applicant_id, job_id)
);
create index platform_job_applications_created on public.platform_job_applications(created_at desc, id desc);
create index platform_job_applications_applicant_created on public.platform_job_applications(applicant_id,created_at desc);
alter table public.platform_job_applications enable row level security;
revoke all on public.platform_job_applications from public, anon, authenticated;
grant all on public.platform_job_applications to service_role;

create function public.submit_platform_application(p_job_id uuid,p_name text,p_note text,p_cv_name text,p_cv_type text,p_cv_base64 text,p_consent boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); account_email text; j public.partner_jobs%rowtype; contents bytea; result uuid;
begin
 if uid is null then raise exception 'SIGN_IN_REQUIRED' using errcode='42501'; end if;
 if p_consent is distinct from true then raise exception 'CONSENT_REQUIRED' using errcode='22023'; end if;
 if p_name is null or char_length(trim(p_name)) not between 2 and 120 or p_note is null or char_length(p_note)>5000 then raise exception 'INVALID_FIELDS' using errcode='22023'; end if;
 if p_cv_name is null or char_length(p_cv_name) not between 1 and 160 or p_cv_name ~ '[\\/[:cntrl:]]' or p_cv_base64 is null or length(p_cv_base64)>2796204 then raise exception 'INVALID_CV' using errcode='22023'; end if;
 if p_cv_type not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document') or p_cv_type is null then raise exception 'INVALID_CV' using errcode='22023'; end if;
 begin contents:=decode(p_cv_base64,'base64'); exception when others then raise exception 'INVALID_CV' using errcode='22023'; end;
 if octet_length(contents) not between 5 and 2097152 or
    (p_cv_type='application/pdf' and substring(contents from 1 for 5)<>decode('255044462d','hex')) or
    (p_cv_type='application/vnd.openxmlformats-officedocument.wordprocessingml.document' and substring(contents from 1 for 4)<>decode('504b0304','hex')) then raise exception 'INVALID_CV' using errcode='22023'; end if;
 select u.email into account_email from auth.users u where u.id=uid and u.email_confirmed_at is not null;
 if account_email is null then raise exception 'VERIFIED_EMAIL_REQUIRED' using errcode='42501'; end if;
 -- Serialise checks for the same applicant to enforce rate and duplicate limits.
 perform pg_advisory_xact_lock(hashtextextended(uid::text,731));
 if exists(select 1 from public.platform_job_applications where applicant_id=uid and job_id=p_job_id) then raise exception 'ALREADY_APPLIED' using errcode='23505'; end if;
 if (select count(*) from public.platform_job_applications where applicant_id=uid and created_at>now()-interval '24 hours')>=10 then raise exception 'DAILY_LIMIT' using errcode='22023'; end if;
 if public.public_job_detail(p_job_id) is null then raise exception 'JOB_UNAVAILABLE' using errcode='22023'; end if;
 select * into j from public.partner_jobs where public_id=p_job_id;
 if not found then raise exception 'JOB_UNAVAILABLE' using errcode='22023'; end if;
 insert into public.platform_job_applications(applicant_id,job_id,job_title,employer,location,applicant_name,applicant_email,cover_note,cv_name,cv_type,cv_bytes)
 values(uid,j.public_id,j.title,coalesce(j.employer,''),coalesce(j.location,''),trim(p_name),account_email,trim(p_note),p_cv_name,p_cv_type,contents) returning id into result;
 return result;
end $$;
revoke all on function public.submit_platform_application(uuid,text,text,text,text,text,boolean) from public, anon;
grant execute on function public.submit_platform_application(uuid,text,text,text,text,text,boolean) to authenticated;

create function public.admin_platform_applications(p_offset integer default 0,p_limit integer default 25)
returns table(id uuid,job_title text,employer text,location text,applicant_name text,applicant_email text,cover_note text,cv_name text,status text,created_at timestamptz,updated_at timestamptz,total bigint)
language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 return query select a.id,a.job_title,a.employer,a.location,a.applicant_name,a.applicant_email,a.cover_note,a.cv_name,a.status,a.created_at,a.updated_at,count(*) over() from public.platform_job_applications a order by a.created_at desc,a.id desc offset least(greatest(coalesce(p_offset,0),0),1000000) limit least(greatest(coalesce(p_limit,25),1),100);
end $$;
create function public.admin_platform_application_cv(p_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 select jsonb_build_object('name',a.cv_name,'type',a.cv_type,'data',encode(a.cv_bytes,'base64')) into result from public.platform_job_applications a where a.id=p_id;
 if result is null then raise exception 'NOT_FOUND' using errcode='22023'; end if;
 return result;
end $$;
create function public.admin_update_platform_application(p_id uuid,p_name text,p_email text,p_note text,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_name is null or char_length(trim(p_name)) not between 2 and 120 or p_email is null or char_length(trim(p_email)) not between 3 and 254 or trim(p_email) !~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' or p_note is null or char_length(p_note)>5000 or p_status is null or p_status not in ('active','suspended') then raise exception 'INVALID_FIELDS' using errcode='22023'; end if;
 update public.platform_job_applications set applicant_name=trim(p_name),applicant_email=trim(p_email),cover_note=trim(p_note),status=p_status,updated_at=now() where id=p_id;
 if not found then raise exception 'NOT_FOUND' using errcode='22023'; end if;
end $$;
create function public.admin_delete_platform_application(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 delete from public.platform_job_applications where id=p_id;
 if not found then raise exception 'NOT_FOUND' using errcode='22023'; end if;
end $$;
revoke all on function public.admin_platform_applications(integer,integer),public.admin_platform_application_cv(uuid),public.admin_update_platform_application(uuid,text,text,text,text),public.admin_delete_platform_application(uuid) from public,anon;
grant execute on function public.admin_platform_applications(integer,integer),public.admin_platform_application_cv(uuid),public.admin_update_platform_application(uuid,text,text,text,text),public.admin_delete_platform_application(uuid) to authenticated;
