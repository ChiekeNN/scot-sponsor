-- Batch counts reuse the same public search as category links, preserving all
-- freshness, complete-description and keyword matching rules. Only aggregate
-- counts are returned; underlying tables and internal implementations stay private.
create or replace function public.public_industry_job_counts(p_categories jsonb)
returns table(id text, total bigint)
language plpgsql stable security definer set search_path = '' as $$
declare category jsonb; term jsonb; seen text[] := '{}'; category_id text;
begin
 if jsonb_typeof(p_categories) is distinct from 'array' or pg_column_size(p_categories) > 16000 then
  raise exception 'INVALID_CATEGORIES' using errcode='22023';
 end if;
 if jsonb_array_length(p_categories) not between 1 and 28 then
  raise exception 'INVALID_CATEGORIES' using errcode='22023';
 end if;
 for category in select value from jsonb_array_elements(p_categories) loop
  category_id := category->>'id';
  if jsonb_typeof(category) is distinct from 'object' or jsonb_typeof(category->'id') is distinct from 'string'
     or category_id !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or length(category_id)>64 or category_id=any(seen)
     or jsonb_typeof(category->'terms') is distinct from 'array' then
   raise exception 'INVALID_CATEGORIES' using errcode='22023';
  end if;
  if jsonb_array_length(category->'terms') not between 1 and 30 then
   raise exception 'INVALID_CATEGORIES' using errcode='22023';
  end if;
  for term in select value from jsonb_array_elements(category->'terms') loop
   if jsonb_typeof(term) is distinct from 'string' or length(term #>> '{}') not between 1 and 100 then
    raise exception 'INVALID_CATEGORIES' using errcode='22023';
   end if;
  end loop;
  seen := array_append(seen,category_id);
 end loop;
 return query
 select c.value->>'id', coalesce((
  select result.total from public.public_job_search(0,1,'','','industry',
   array(select jsonb_array_elements_text(c.value->'terms')),'{}'::text[],false,null) result limit 1
 ),0::bigint)
 from jsonb_array_elements(p_categories) c(value);
end $$;
revoke all on function public.public_industry_job_counts(jsonb) from public;
grant execute on function public.public_industry_job_counts(jsonb) to anon,authenticated,service_role;
