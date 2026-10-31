-- Directory of verified accounts with an active, manually granted pass. This
-- does not create chat threads until an administrator chooses a member.
create function public.chat_admin_members(p_search text default '',p_offset integer default 0)
returns table(id uuid,email text) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if length(coalesce(p_search,''))>200 then raise exception 'INVALID_SEARCH' using errcode='22023'; end if;
 return query select u.id,u.email::text from auth.users u where u.email_confirmed_at is not null and u.id<>auth.uid()
 and not exists(select 1 from public.super_admins a where a.user_id=u.id)
 and exists(select 1 from public.member_entitlements e where e.user_id=u.id and e.plan in ('job_hunt_pass','monthly_alert_pass') and e.starts_at<=now() and e.expires_at>now() and e.revoked_at is null)
 and strpos(lower(u.email),lower(trim(coalesce(p_search,''))))>0
 order by lower(u.email),u.id offset least(greatest(coalesce(p_offset,0),0),100000) limit 50;
end $$;
revoke all on function public.chat_admin_members(text,integer) from public,anon,authenticated;
grant execute on function public.chat_admin_members(text,integer) to authenticated;

create table public.member_announcements(id uuid primary key,author_id uuid not null references auth.users(id),title text not null check(length(title) between 3 and 160),body text not null check(length(body) between 10 and 5000),audience text not null check(audience in ('all','selected')),created_at timestamptz not null default now());
create table public.member_announcement_recipients(announcement_id uuid not null references public.member_announcements(id) on delete cascade,user_id uuid not null references auth.users(id) on delete cascade,read_at timestamptz,primary key(announcement_id,user_id));
create index member_announcement_inbox on public.member_announcement_recipients(user_id,announcement_id);
alter table public.member_announcements enable row level security;
alter table public.member_announcement_recipients enable row level security;
revoke all on public.member_announcements,public.member_announcement_recipients from public,anon,authenticated;
grant all on public.member_announcements,public.member_announcement_recipients to service_role;

-- Snapshot recipients at publication time; no email, SMS or push is sent.
create function public.announcement_publish(p_id uuid,p_title text,p_body text,p_audience text,p_members uuid[] default null) returns integer language plpgsql security definer set search_path='' as $$
declare count_members integer; existing public.member_announcements%rowtype;
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_id is null or length(trim(coalesce(p_title,''))) not between 3 and 160 or length(trim(coalesce(p_body,''))) not between 10 and 5000 or p_audience is null or p_audience not in ('all','selected') then raise exception 'INVALID_ANNOUNCEMENT' using errcode='22023'; end if;
 if p_audience='selected' and (coalesce(cardinality(p_members),0)=0 or cardinality(p_members)>500 or array_position(p_members,null) is not null or cardinality(p_members)<>(select count(distinct x) from unnest(p_members) x)) then raise exception 'INVALID_RECIPIENTS' using errcode='22023'; end if;
 if p_audience='all' and coalesce(cardinality(p_members),0)>0 then raise exception 'INVALID_RECIPIENTS' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into existing from public.member_announcements where id=p_id;
 if found then
  if existing.author_id<>auth.uid() or existing.title<>trim(p_title) or existing.body<>trim(p_body) or existing.audience<>p_audience or (p_audience='selected' and ((select count(*) from public.member_announcement_recipients where announcement_id=p_id)<>cardinality(p_members) or exists(select 1 from unnest(p_members) x where not exists(select 1 from public.member_announcement_recipients r where r.announcement_id=p_id and r.user_id=x)))) then raise exception 'INVALID_ANNOUNCEMENT' using errcode='22023'; end if;
  return (select count(*)::integer from public.member_announcement_recipients where announcement_id=p_id);
 end if;
 insert into public.member_announcements(id,author_id,title,body,audience) values(p_id,auth.uid(),trim(p_title),trim(p_body),p_audience);
 insert into public.member_announcement_recipients(announcement_id,user_id)
 select p_id,u.id from auth.users u where u.email_confirmed_at is not null and not exists(select 1 from public.super_admins a where a.user_id=u.id)
 and exists(select 1 from public.member_entitlements e where e.user_id=u.id and e.plan in ('job_hunt_pass','monthly_alert_pass') and e.starts_at<=now() and e.expires_at>now() and e.revoked_at is null)
 and (p_audience='all' or u.id=any(p_members));
 get diagnostics count_members = row_count;
 if count_members=0 or (p_audience='selected' and count_members<>cardinality(p_members)) then raise exception 'RECIPIENTS_UNAVAILABLE' using errcode='22023'; end if;
 return count_members;
end $$;
create function public.announcement_list(p_offset integer default 0) returns table(id uuid,title text,body text,created_at timestamptz,audience text,recipient_count bigint,read_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_access_member_insights() or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
 return query select a.id,a.title,a.body,a.created_at,case when public.is_super_admin() then a.audience else null end,case when public.is_super_admin() then (select count(*) from public.member_announcement_recipients r2 where r2.announcement_id=a.id) else null end,r.read_at
 from public.member_announcements a left join public.member_announcement_recipients r on r.announcement_id=a.id and r.user_id=auth.uid()
 where public.is_super_admin() or r.user_id is not null order by a.created_at desc,a.id desc offset least(greatest(coalesce(p_offset,0),0),100000) limit 20;
end $$;
create function public.announcement_unread_count() returns integer language sql stable security definer set search_path='' as $$
 select case when auth.uid() is not null and public.can_access_member_insights() and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then (select count(*)::integer from public.member_announcement_recipients r where r.user_id=auth.uid() and r.read_at is null) else 0 end;
$$;
create function public.announcement_mark_read(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_access_member_insights() or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
 update public.member_announcement_recipients set read_at=coalesce(read_at,now()) where announcement_id=p_id and user_id=auth.uid();
 if not found then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
end $$;
create function public.announcement_delete(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 delete from public.member_announcements where id=p_id;
 if not found then raise exception 'NOT_FOUND' using errcode='22023'; end if;
end $$;
revoke all on function public.announcement_publish(uuid,text,text,text,uuid[]),public.announcement_list(integer),public.announcement_unread_count(),public.announcement_mark_read(uuid),public.announcement_delete(uuid) from public,anon,authenticated;
grant execute on function public.announcement_publish(uuid,text,text,text,uuid[]),public.announcement_list(integer),public.announcement_unread_count(),public.announcement_mark_read(uuid),public.announcement_delete(uuid) to authenticated;
