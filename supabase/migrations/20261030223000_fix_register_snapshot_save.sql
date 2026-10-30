-- Preserve matching records and remove only snapshots no longer in the active
-- directory. This respects the database's protection against unscoped deletes.
create or replace function public.register_monitor_apply(p_version uuid, p_url text, p_published timestamptz, p_rows jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare previous_version uuid; current_published timestamptz; changed integer := 0; previous_found bigint; current_found bigint; expected_count bigint; unique_count bigint;
begin
 if p_url !~ '^https://assets[.]publishing[.]service[.]gov[.]uk/media/' or p_published is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Invalid register snapshot'; end if;
 if not exists (select 1 from public.sponsor_directory_versions where id = p_version and active) then raise exception 'Directory version changed'; end if;
 select count(*) into expected_count from public.sponsor_directory where version_id = p_version;
 select count(distinct x.id) into unique_count from jsonb_to_recordset(p_rows) as x(id bigint);
 if jsonb_array_length(p_rows) <> expected_count or unique_count <> expected_count or exists (
   select 1 from jsonb_to_recordset(p_rows) as x(id bigint)
   where not exists (select 1 from public.sponsor_directory s where s.version_id = p_version and s.id = x.id)
 ) then raise exception 'Incomplete snapshot'; end if;
 select version_id, source_published into previous_version, current_published from public.register_monitor_state where id for update;
 if current_published is not null and p_published < current_published then raise exception 'Older source snapshot'; end if;
 if previous_version = p_version then
   select count(*) into previous_found from public.register_monitor_snapshots where jsonb_array_length(entries) > 0;
   select count(*) into current_found from jsonb_to_recordset(p_rows) as x(entries jsonb) where jsonb_array_length(x.entries) > 0;
   if previous_found > 100 and current_found < previous_found * 0.5 then raise exception 'Unexpected drop in matched sponsors'; end if;
   insert into public.admin_notifications(kind,organisation_name,city_town,before_entries,after_entries,source_url)
   select 'register_change', x.name, x.town, old.entries, x.entries, p_url
   from jsonb_to_recordset(p_rows) as x(id bigint, name text, town text, entries jsonb)
   join public.register_monitor_snapshots old on old.sponsor_id = x.id where old.entries is distinct from x.entries;
   get diagnostics changed = row_count;
 end if;
 delete from public.register_monitor_snapshots old
 where not exists (select 1 from public.sponsor_directory s where s.version_id=p_version and s.id=old.sponsor_id);
 insert into public.register_monitor_snapshots(sponsor_id,organisation_name,city_town,entries)
 select id, name, town, entries from jsonb_to_recordset(p_rows) as x(id bigint, name text, town text, entries jsonb)
 on conflict (sponsor_id) do update set organisation_name=excluded.organisation_name, city_town=excluded.city_town, entries=excluded.entries;
 update public.register_monitor_state set version_id=p_version, source_url=p_url, source_published=p_published,
   last_checked=now(), last_success=now(), last_error=null where id;
 return changed;
end;
$$;
