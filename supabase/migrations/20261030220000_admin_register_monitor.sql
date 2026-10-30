-- Private administrator notifications and daily Home Office snapshot monitoring.
create table public.register_monitor_state (
 id boolean primary key default true check (id), version_id uuid, source_url text,
 source_published timestamptz, last_checked timestamptz, last_success timestamptz,
 last_error text
);
insert into public.register_monitor_state(id) values(true);
create table public.register_monitor_snapshots (
 sponsor_id bigint primary key, organisation_name text not null, city_town text not null,
 entries jsonb not null
);
create table public.admin_notifications (
 id bigint generated always as identity primary key, kind text not null,
 organisation_name text, city_town text, before_entries jsonb, after_entries jsonb,
 source_url text, occurred_at timestamptz not null default now()
);
create table public.admin_notification_reads (
 notification_id bigint not null references public.admin_notifications(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 read_at timestamptz not null default now(), primary key(notification_id,user_id)
);
alter table public.register_monitor_state enable row level security;
alter table public.register_monitor_snapshots enable row level security;
alter table public.admin_notifications enable row level security;
alter table public.admin_notification_reads enable row level security;
revoke all on public.register_monitor_state, public.register_monitor_snapshots, public.admin_notifications, public.admin_notification_reads from public, anon, authenticated;
grant all on public.register_monitor_state, public.register_monitor_snapshots, public.admin_notifications, public.admin_notification_reads to service_role;
grant usage, select on sequence public.admin_notifications_id_seq to service_role;

-- The random invocation token is generated inside Postgres and stored encrypted.
select vault.create_secret(replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-',''), 'register_monitor_token');
create function public.register_monitor_authorise(p_token text) returns boolean language sql security definer set search_path = '' as $$
 select p_token is not null and exists(select 1 from vault.decrypted_secrets where name = 'register_monitor_token' and decrypted_secret = p_token);
$$;
revoke all on function public.register_monitor_authorise(text) from public, anon, authenticated;
grant execute on function public.register_monitor_authorise(text) to service_role;

create function public.register_monitor_sponsors() returns jsonb language sql stable security definer set search_path = '' as $$
 select jsonb_build_object('version', v.id, 'sponsors', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.organisation_name, 'town', s.city_town) order by s.id) from public.sponsor_directory s where s.version_id = v.id), '[]'::jsonb))
 from public.sponsor_directory_versions v where v.active limit 1;
$$;
revoke all on function public.register_monitor_sponsors() from public, anon, authenticated;
grant execute on function public.register_monitor_sponsors() to service_role;

-- Apply a fully validated register atomically; a newly published directory gets
-- a fresh baseline, never thousands of misleading 'new' notifications.
create function public.register_monitor_apply(p_version uuid, p_url text, p_published timestamptz, p_rows jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare previous_version uuid; current_published timestamptz; changed integer := 0; previous_found bigint; current_found bigint;
begin
 if p_url !~ '^https://assets[.]publishing[.]service[.]gov[.]uk/media/' or p_published is null or jsonb_typeof(p_rows) <> 'array' then raise exception 'Invalid register snapshot'; end if;
 if not exists (select 1 from public.sponsor_directory_versions where id = p_version and active) then raise exception 'Directory version changed'; end if;
 if jsonb_array_length(p_rows) <> (select count(*) from public.sponsor_directory where version_id = p_version) then raise exception 'Incomplete snapshot'; end if;
 select version_id, source_published into previous_version, current_published from public.register_monitor_state where id for update;
 if current_published is not null and p_published < current_published then raise exception 'Older source snapshot'; end if;
 if previous_version = p_version then
   select count(*) into previous_found from public.register_monitor_snapshots where jsonb_array_length(entries) > 0;
   select count(*) into current_found from jsonb_to_recordset(p_rows) as x(entries jsonb) where jsonb_array_length(x.entries) > 0;
   if previous_found > 100 and current_found < previous_found * 0.5 then raise exception 'Unexpected drop in matched sponsors'; end if;
   insert into public.admin_notifications(kind,organisation_name,city_town,before_entries,after_entries,source_url)
   select 'register_change', x.name, x.town, old.entries, x.entries, p_url
   from jsonb_to_recordset(p_rows) as x(id bigint, name text, town text, entries jsonb)
   join public.register_monitor_snapshots old on old.sponsor_id = x.id
   where old.entries is distinct from x.entries;
   get diagnostics changed = row_count;
 end if;
 delete from public.register_monitor_snapshots;
 insert into public.register_monitor_snapshots(sponsor_id,organisation_name,city_town,entries)
 select id, name, town, entries from jsonb_to_recordset(p_rows) as x(id bigint, name text, town text, entries jsonb);
 update public.register_monitor_state set version_id=p_version, source_url=p_url, source_published=p_published,
   last_checked=now(), last_success=now(), last_error=null where id;
 return changed;
end;
$$;
revoke all on function public.register_monitor_apply(uuid,text,timestamptz,jsonb) from public, anon, authenticated;
grant execute on function public.register_monitor_apply(uuid,text,timestamptz,jsonb) to service_role;

create function public.register_monitor_fail() returns void language plpgsql security definer set search_path = '' as $$
begin
 update public.register_monitor_state set last_checked=now(), last_error='The latest Home Office register check failed.' where id;
 if not exists (select 1 from public.admin_notifications where kind='monitor_error' and occurred_at > now()-interval '24 hours') then
   insert into public.admin_notifications(kind) values ('monitor_error');
 end if;
end;
$$;
revoke all on function public.register_monitor_fail() from public, anon, authenticated;
grant execute on function public.register_monitor_fail() to service_role;

create function public.admin_notification_feed() returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare feed jsonb; status jsonb; unread bigint;
begin
 if not public.is_super_admin() then raise exception 'Not authorised' using errcode='42501'; end if;
 select count(*) into unread from public.admin_notifications n where not exists(select 1 from public.admin_notification_reads r where r.notification_id=n.id and r.user_id=auth.uid());
 select coalesce(jsonb_agg(row_to_json(q) order by q.occurred_at desc, q.id desc), '[]'::jsonb) into feed from (
   select n.id,n.kind,n.organisation_name,n.city_town,n.before_entries,n.after_entries,n.source_url,n.occurred_at,
   exists(select 1 from public.admin_notification_reads r where r.notification_id=n.id and r.user_id=auth.uid()) as is_read
   from public.admin_notifications n order by n.occurred_at desc,n.id desc limit 100
 ) q;
 select jsonb_build_object('last_checked',last_checked,'last_success',last_success,'source_published',source_published,'last_error',last_error) into status from public.register_monitor_state where id;
 return jsonb_build_object('unread',unread,'items',feed,'monitor',status);
end;
$$;
revoke all on function public.admin_notification_feed() from public, anon;
grant execute on function public.admin_notification_feed() to authenticated;
create function public.admin_notification_read(p_id bigint) returns void language plpgsql security definer set search_path = '' as $$
begin
 if not public.is_super_admin() then raise exception 'Not authorised' using errcode='42501'; end if;
 insert into public.admin_notification_reads(notification_id,user_id) select id,auth.uid() from public.admin_notifications where id=p_id on conflict do nothing;
end;
$$;
revoke all on function public.admin_notification_read(bigint) from public, anon;
grant execute on function public.admin_notification_read(bigint) to authenticated;
