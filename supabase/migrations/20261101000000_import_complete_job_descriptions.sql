-- Accept complete licensed-provider records only for the same current listing.
-- No public caller may write descriptions or access source identifiers.
create function public.import_adzuna_full_description(
 p_job_id uuid,p_external_id text,p_title text,p_employer text,p_location text,
 p_excerpt text,p_description text,p_observed_at timestamptz
) returns text language plpgsql security definer set search_path='' as $$
declare j public.partner_jobs%rowtype; fingerprint text; changed integer;
begin
 select * into j from public.partner_jobs where public_id=p_job_id and source='adzuna' and external_id=p_external_id for update;
 if not found then return 'mismatch'; end if;
 if public.public_job_detail(j.public_id) is null then return 'unavailable'; end if;
 if lower(regexp_replace(trim(coalesce(p_title,'')),'\s+',' ','g'))<>lower(regexp_replace(trim(j.title),'\s+',' ','g'))
 or lower(regexp_replace(trim(coalesce(p_employer,'')),'\s+',' ','g'))<>lower(regexp_replace(trim(j.employer),'\s+',' ','g'))
 or lower(regexp_replace(trim(coalesce(p_location,'')),'\s+',' ','g'))<>lower(regexp_replace(trim(j.location),'\s+',' ','g'))
 or p_excerpt is distinct from j.description then return 'mismatch'; end if;
 if p_observed_at is null or p_observed_at > now() or p_observed_at < now()-interval '7 days' then return 'stale'; end if;
 if p_description is null or char_length(trim(p_description)) not between 20 and 30000
 or lower(p_description) like '%adzuna%' or trim(p_description)=trim(j.description) then return 'invalid'; end if;
 fingerprint:=public.job_listing_fingerprint(j.title,j.employer,j.location,j.description);
 if exists(select 1 from public.partner_detail_exclusions where job_id=j.public_id and listing_fingerprint=fingerprint) then return 'manual_preserved'; end if;
 insert into public.job_complete_descriptions(job_id,description,listing_fingerprint,updated_by,updated_at,origin)
 values(j.public_id,trim(p_description),fingerprint,null,p_observed_at,'provider')
 on conflict(job_id) do update set description=excluded.description,listing_fingerprint=excluded.listing_fingerprint,updated_by=null,updated_at=excluded.updated_at,origin='provider'
 where public.job_complete_descriptions.origin='provider' and public.job_complete_descriptions.updated_at<=excluded.updated_at;
 get diagnostics changed = row_count;
 if changed=0 then return 'manual_preserved'; end if;
 return 'saved';
end; $$;
revoke all on function public.import_adzuna_full_description(uuid,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.import_adzuna_full_description(uuid,text,text,text,text,text,text,timestamptz) to service_role;
