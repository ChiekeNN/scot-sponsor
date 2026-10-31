-- Full descriptions are kept separately from provider excerpts and can only be curated by super-admins.
alter table public.partner_jobs add column salary_min numeric, add column salary_max numeric, add column salary_is_predicted boolean, add column contract_type text, add column contract_time text;
create table public.job_complete_descriptions (
 job_id uuid primary key references public.partner_jobs(public_id) on delete cascade,
 description text not null check(char_length(description) between 20 and 30000),
 listing_fingerprint text not null, updated_at timestamptz not null default now(), updated_by uuid not null references auth.users(id)
);
alter table public.job_complete_descriptions enable row level security;
revoke all on public.job_complete_descriptions from public, anon, authenticated;
grant all on public.job_complete_descriptions to service_role;
create function public.job_listing_fingerprint(p_title text,p_employer text,p_location text,p_excerpt text)
returns text language sql immutable set search_path='' as $$ select md5(jsonb_build_array(p_title,p_employer,p_location,p_excerpt)::text) $$;
revoke all on function public.job_listing_fingerprint(text,text,text,text) from public, anon, authenticated;

create function public.public_job_detail(p_job_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',j.public_id,'title',j.title,'employer',j.employer,'location',j.location,'posted_at',j.posted_at,
  'excerpt',j.description,'full_description',case when d.listing_fingerprint=public.job_listing_fingerprint(j.title,j.employer,j.location,j.description) then d.description else null end,
  'salary_min',j.salary_min,'salary_max',j.salary_max,'salary_is_predicted',j.salary_is_predicted,'contract_type',j.contract_type,'contract_time',j.contract_time)
 from public.partner_jobs j join public.partner_job_sync_status s on s.source=j.source left join public.job_complete_descriptions d on d.job_id=j.public_id
 where j.public_id=p_job_id and j.posted_at >= now()-interval '14 days' and j.posted_at <= now()
 and j.last_seen >= now()-interval '5 days' and s.last_success is not null and j.last_seen <= s.last_success
 and concat_ws(' ',j.title,j.description,j.employer,j.location) not ilike '%adzuna%';
$$;
revoke all on function public.public_job_detail(uuid) from public;
grant execute on function public.public_job_detail(uuid) to anon, authenticated;

create function public.admin_job_full_description(p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 select jsonb_build_object('description',d.description,'current',d.listing_fingerprint=public.job_listing_fingerprint(j.title,j.employer,j.location,j.description),'updated_at',d.updated_at) into result
 from public.partner_jobs j left join public.job_complete_descriptions d on d.job_id=j.public_id where j.public_id=p_job_id;
 return result;
end; $$;
revoke all on function public.admin_job_full_description(uuid) from public, anon;
grant execute on function public.admin_job_full_description(uuid) to authenticated;

create function public.admin_save_job_full_description(p_job_id uuid,p_description text,p_confirm boolean) returns void language plpgsql security definer set search_path='' as $$
declare j public.partner_jobs%rowtype;
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_confirm is distinct from true then raise exception 'CONFIRMATION_REQUIRED' using errcode='22023'; end if;
 if p_description is null or char_length(trim(p_description)) not between 20 and 30000 or position('adzuna' in lower(p_description))>0 then raise exception 'INVALID_DESCRIPTION' using errcode='22023'; end if;
 select * into j from public.partner_jobs where public_id=p_job_id;
 if not found or public.public_job_detail(p_job_id) is null then raise exception 'JOB_UNAVAILABLE' using errcode='22023'; end if;
 insert into public.job_complete_descriptions(job_id,description,listing_fingerprint,updated_by,updated_at)
 values(j.public_id,trim(p_description),public.job_listing_fingerprint(j.title,j.employer,j.location,j.description),auth.uid(),now())
 on conflict(job_id) do update set description=excluded.description,listing_fingerprint=excluded.listing_fingerprint,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
end; $$;
revoke all on function public.admin_save_job_full_description(uuid,text,boolean) from public, anon;
grant execute on function public.admin_save_job_full_description(uuid,text,boolean) to authenticated;
