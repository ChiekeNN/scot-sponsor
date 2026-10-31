-- Small, subscriber-only lookup over the current Scottish directory and the
-- separately maintained Home Office register snapshot. This does not widen the
-- directory's RLS policy or grant direct directory-table access.
create function public.member_sponsorship_checker(p_search text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare q text := trim(coalesce(p_search, '')); result jsonb;
begin
 if (select auth.uid()) is null or not public.can_access_member_insights() then
   raise exception 'NOT_AUTHORISED' using errcode = '42501';
 end if;
 if char_length(q) < 3 or char_length(q) > 100 then
   raise exception 'INVALID_SEARCH' using errcode = '22023';
 end if;
 select jsonb_build_object(
   'last_success', m.last_success,
   'source_published', m.source_published,
   'items', coalesce((select jsonb_agg(jsonb_build_object(
     'id', item.id, 'name', item.organisation_name, 'town', item.city_town, 'region', item.county_region,
     'status', case when m.version_id is distinct from v.id or m.last_success is null or m.last_success < now() - interval '3 days' or item.entries is null then 'unavailable'
       when jsonb_array_length(item.entries) > 0 then 'matched' else 'unmatched' end,
     'entries', case when m.version_id = v.id and m.last_success >= now() - interval '3 days' then coalesce(item.entries, '[]'::jsonb) else '[]'::jsonb end
   ) order by item.organisation_name, item.city_town, item.id)
   from (select s.id,s.organisation_name,s.city_town,s.county_region,ss.entries
     from public.sponsor_directory s left join public.register_monitor_snapshots ss on ss.sponsor_id = s.id
     where s.version_id = v.id and position(lower(q) in lower(s.organisation_name)) > 0
     order by s.organisation_name,s.city_town,s.id limit 15) item), '[]'::jsonb)
 ) into result
 from public.sponsor_directory_versions v cross join public.register_monitor_state m
 where v.active and m.id = true limit 1;
 return coalesce(result, jsonb_build_object('last_success',null,'source_published',null,'items','[]'::jsonb));
end; $$;
revoke all on function public.member_sponsorship_checker(text) from public, anon, authenticated;
grant execute on function public.member_sponsorship_checker(text) to authenticated;
