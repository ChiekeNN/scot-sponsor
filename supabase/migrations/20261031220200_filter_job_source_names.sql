-- Exclude rather than alter a listing if its own text contains the upstream provider name.
create or replace function public.public_job_list(p_offset integer default 0,p_limit integer default 1000)
returns table(id uuid,title text,description text,employer text,location text,posted_at timestamptz)
language sql stable security definer set search_path='' as $$
 select j.public_id,j.title,j.description,j.employer,j.location,j.posted_at
 from public.partner_jobs j join public.partner_job_sync_status s on s.source=j.source
 where j.posted_at >= now()-interval '14 days' and j.posted_at <= now()
 and j.last_seen >= now()-interval '5 days' and s.last_success is not null and j.last_seen <= s.last_success
 and concat_ws(' ',j.title,j.description,j.employer,j.location) not ilike '%adzuna%'
 order by j.posted_at desc,j.public_id asc offset greatest(coalesce(p_offset,0),0) limit least(greatest(coalesce(p_limit,1000),1),1000);
$$;
