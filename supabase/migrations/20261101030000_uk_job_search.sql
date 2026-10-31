-- Search metadata does not change the source identity or description fingerprint.
alter table public.partner_jobs add column if not exists location_search text;
-- Every pre-existing row was collected by the Scotland-only adapter.
update public.partner_jobs set location_search=concat_ws(', ', location, 'Scotland') where location_search is null;

create function public.job_search_normalise(p_text text) returns text language sql immutable parallel safe set search_path='' as $$
 select trim(regexp_replace(lower(coalesce(p_text,'')), '[^[:alnum:]]+', ' ', 'g'));
$$;
revoke all on function public.job_search_normalise(text) from public, anon, authenticated;

-- Only current, matching complete descriptions are returned. Filters and
-- pagination operate on the server, not a truncated browser-side cache.
create function public.public_job_search(p_offset integer default 0,p_limit integer default 50,p_query text default '',p_location text default '',p_kind text default null,p_terms text[] default null,p_title_terms text[] default null,p_include_excerpt boolean default false,p_saved_ids uuid[] default null)
returns table(id uuid,title text,description text,employer text,location text,posted_at timestamptz,total bigint)
language sql stable security definer set search_path='' as $$
 select j.public_id,j.title,j.description,j.employer,j.location,j.posted_at,count(*) over()
 from public.partner_jobs j join public.partner_job_sync_status s on s.source=j.source
 join public.job_complete_descriptions d on d.job_id=j.public_id
 where j.posted_at>=now()-interval '14 days' and j.posted_at<=now()
 and j.last_seen>=now()-interval '5 days' and s.last_success is not null and j.last_seen<=s.last_success
 and (j.expires_at is null or j.expires_at>now()) and concat_ws(' ',j.title,j.description,j.employer,j.location) not ilike '%adzuna%'
 and d.listing_fingerprint=public.job_listing_fingerprint(j.title,j.employer,j.location,j.description)
 and (d.origin='manual' or d.updated_at>=now()-interval '7 days')
 and char_length(coalesce(p_query,''))<=200 and char_length(coalesce(p_location,''))<=200
 and (coalesce(trim(p_query),'')='' or position(lower(trim(p_query)) in lower(concat_ws(' ',j.title,j.employer,j.location)))>0)
 and (coalesce(trim(p_location),'')='' or position(lower(trim(p_location)) in lower(concat_ws(' ',j.location,j.location_search)))>0)
 and (p_saved_ids is null or (cardinality(p_saved_ids)<=2000 and j.public_id=any(p_saved_ids)))
 and (p_kind is null or (p_kind in ('industry','popular','location') and cardinality(p_terms)<=100 and cardinality(coalesce(p_title_terms,'{}'::text[]))<=100 and (
   exists(select 1 from unnest(p_terms) t where char_length(t) between 1 and 100 and public.job_search_normalise(t)<>'' and position(' '||public.job_search_normalise(t)||' ' in ' '||public.job_search_normalise(case when p_kind='location' then concat_ws(' ',j.location,j.location_search) when p_include_excerpt then concat_ws(' ',j.title,j.description) else j.title end)||' ')>0)
   or exists(select 1 from unnest(coalesce(p_title_terms,'{}'::text[])) t where char_length(t) between 1 and 100 and public.job_search_normalise(t)<>'' and position(' '||public.job_search_normalise(t)||' ' in ' '||public.job_search_normalise(j.title)||' ')>0)
 )))
 order by j.posted_at desc,j.public_id asc offset least(greatest(coalesce(p_offset,0),0),1000000) limit least(greatest(coalesce(p_limit,50),1),100);
$$;
revoke all on function public.public_job_search(integer,integer,text,text,text,text[],text[],boolean,uuid[]) from public, anon, authenticated;
grant execute on function public.public_job_search(integer,integer,text,text,text,text[],text[],boolean,uuid[]) to anon, authenticated;
