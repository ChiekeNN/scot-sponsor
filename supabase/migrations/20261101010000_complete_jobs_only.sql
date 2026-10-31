-- Current-feed eligibility remains separate from public visibility so authorised
-- importers can enrich a listing before its complete description is published.
create function public.is_current_partner_job(p_job_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.partner_jobs j join public.partner_job_sync_status s on s.source=j.source
 where j.public_id=p_job_id and j.posted_at>=now()-interval '14 days' and j.posted_at<=now()
 and j.last_seen>=now()-interval '5 days' and s.last_success is not null and j.last_seen<=s.last_success
 and (j.expires_at is null or j.expires_at>now())
 and concat_ws(' ',j.title,j.description,j.employer,j.location) not ilike '%adzuna%');
$$;
revoke all on function public.is_current_partner_job(uuid) from public, anon, authenticated;

-- Keep source rows for matching and retention; expose only current complete text.
create or replace function public.public_job_list(p_offset integer default 0,p_limit integer default 1000)
returns table(id uuid,title text,description text,employer text,location text,posted_at timestamptz)
language sql stable security definer set search_path='' as $$
 select j.public_id,j.title,j.description,j.employer,j.location,j.posted_at
 from public.partner_jobs j join public.partner_job_sync_status s on s.source=j.source
 join public.job_complete_descriptions d on d.job_id=j.public_id
 where j.posted_at>=now()-interval '14 days' and j.posted_at<=now()
 and j.last_seen>=now()-interval '5 days' and s.last_success is not null and j.last_seen<=s.last_success
 and (j.expires_at is null or j.expires_at>now()) and concat_ws(' ',j.title,j.description,j.employer,j.location) not ilike '%adzuna%'
 and d.listing_fingerprint=public.job_listing_fingerprint(j.title,j.employer,j.location,j.description)
 and (d.origin='manual' or d.updated_at>=now()-interval '7 days')
 order by j.posted_at desc,j.public_id asc offset greatest(coalesce(p_offset,0),0) limit least(greatest(coalesce(p_limit,1000),1),1000);
$$;
create or replace function public.public_job_detail(p_job_id uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('id',j.public_id,'title',j.title,'employer',j.employer,'location',j.location,'posted_at',j.posted_at,'expires_at',j.expires_at,
  'excerpt',j.description,'full_description',d.description,'salary_min',j.salary_min,'salary_max',j.salary_max,'salary_is_predicted',j.salary_is_predicted,'salary_period',j.salary_period,'contract_type',j.contract_type,'contract_time',j.contract_time)
 from public.partner_jobs j join public.partner_job_sync_status s on s.source=j.source
 join public.job_complete_descriptions d on d.job_id=j.public_id
 where j.public_id=p_job_id and j.posted_at>=now()-interval '14 days' and j.posted_at<=now()
 and j.last_seen>=now()-interval '5 days' and s.last_success is not null and j.last_seen<=s.last_success
 and (j.expires_at is null or j.expires_at>now()) and concat_ws(' ',j.title,j.description,j.employer,j.location) not ilike '%adzuna%'
 and d.listing_fingerprint=public.job_listing_fingerprint(j.title,j.employer,j.location,j.description)
 and (d.origin='manual' or d.updated_at>=now()-interval '7 days');
$$;

-- Importers and admin edits operate on current private candidates, not the
-- complete-only public view. Existing identity and manual-protection checks remain.
create or replace function public.import_adzuna_full_description(p_job_id uuid,p_external_id text,p_title text,p_employer text,p_location text,p_excerpt text,p_description text,p_observed_at timestamptz)
returns text language plpgsql security definer set search_path='' as $$
declare j public.partner_jobs%rowtype; fingerprint text; changed integer;
begin
 select * into j from public.partner_jobs where public_id=p_job_id and source='adzuna' and external_id=p_external_id for update;
 if not found then return 'mismatch'; end if;
 if not public.is_current_partner_job(j.public_id) then return 'unavailable'; end if;
 if lower(regexp_replace(trim(coalesce(p_title,'')),'\s+',' ','g'))<>lower(regexp_replace(trim(j.title),'\s+',' ','g'))
 or lower(regexp_replace(trim(coalesce(p_employer,'')),'\s+',' ','g'))<>lower(regexp_replace(trim(j.employer),'\s+',' ','g'))
 or lower(regexp_replace(trim(coalesce(p_location,'')),'\s+',' ','g'))<>lower(regexp_replace(trim(j.location),'\s+',' ','g'))
 or p_excerpt is distinct from j.description then return 'mismatch'; end if;
 if p_observed_at is null or p_observed_at>now() or p_observed_at<now()-interval '7 days' then return 'stale'; end if;
 if p_description is null or char_length(trim(p_description)) not between 20 and 30000 or lower(p_description) like '%adzuna%' or trim(p_description)=trim(j.description) then return 'invalid'; end if;
 fingerprint:=public.job_listing_fingerprint(j.title,j.employer,j.location,j.description);
 if exists(select 1 from public.partner_detail_exclusions where job_id=j.public_id and listing_fingerprint=fingerprint) then return 'manual_preserved'; end if;
 insert into public.job_complete_descriptions(job_id,description,listing_fingerprint,updated_by,updated_at,origin)
 values(j.public_id,trim(p_description),fingerprint,null,p_observed_at,'provider')
 on conflict(job_id) do update set description=excluded.description,listing_fingerprint=excluded.listing_fingerprint,updated_by=null,updated_at=excluded.updated_at,origin='provider'
 where public.job_complete_descriptions.origin='provider' and public.job_complete_descriptions.updated_at<=excluded.updated_at;
 get diagnostics changed=row_count;
 if changed=0 then return 'manual_preserved'; end if;
 return 'saved';
end; $$;
create or replace function public.admin_save_job_full_description(p_job_id uuid,p_description text,p_confirm boolean) returns void language plpgsql security definer set search_path='' as $$
declare j public.partner_jobs%rowtype;
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_confirm is distinct from true then raise exception 'CONFIRMATION_REQUIRED' using errcode='22023'; end if;
 if p_description is null or char_length(trim(p_description)) not between 20 and 30000 or position('adzuna' in lower(p_description))>0 then raise exception 'INVALID_DESCRIPTION' using errcode='22023'; end if;
 select * into j from public.partner_jobs where public_id=p_job_id for update;
 if not found or not public.is_current_partner_job(p_job_id) then raise exception 'JOB_UNAVAILABLE' using errcode='22023'; end if;
 insert into public.job_complete_descriptions(job_id,description,listing_fingerprint,updated_by,updated_at,origin)
 values(j.public_id,trim(p_description),public.job_listing_fingerprint(j.title,j.employer,j.location,j.description),auth.uid(),now(),'manual')
 on conflict(job_id) do update set description=excluded.description,listing_fingerprint=excluded.listing_fingerprint,updated_by=excluded.updated_by,updated_at=excluded.updated_at,origin='manual';
end; $$;
