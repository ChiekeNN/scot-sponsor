-- Make only the public job projections accessible without a subscription.
-- The underlying tables and implementation functions remain private.
create or replace function public.public_job_list(p_offset integer default 0,p_limit integer default 1000)
returns table(id uuid,title text,description text,employer text,location text,posted_at timestamptz)
language sql stable security definer set search_path='' as $$
 select * from public.member_job_list_impl(p_offset,p_limit);
$$;
create or replace function public.public_job_detail(p_job_id uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select public.member_job_detail_impl(p_job_id);
$$;
create or replace function public.public_job_search(p_offset integer default 0,p_limit integer default 50,p_query text default '',p_location text default '',p_kind text default null,p_terms text[] default null,p_title_terms text[] default null,p_include_excerpt boolean default false,p_saved_ids uuid[] default null)
returns table(id uuid,title text,description text,employer text,location text,posted_at timestamptz,total bigint)
language sql stable security definer set search_path='' as $$
 select * from public.member_job_search_impl(p_offset,p_limit,p_query,p_location,p_kind,p_terms,p_title_terms,p_include_excerpt,p_saved_ids);
$$;
revoke all on function public.public_job_list(integer,integer),public.public_job_detail(uuid),public.public_job_search(integer,integer,text,text,text,text[],text[],boolean,uuid[]) from public;
grant execute on function public.public_job_list(integer,integer),public.public_job_detail(uuid),public.public_job_search(integer,integer,text,text,text,text[],text[],boolean,uuid[]) to anon,authenticated,service_role;
