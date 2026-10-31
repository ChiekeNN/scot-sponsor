-- Protect job data at the database boundary, not only in the browser.
-- Keep the existing query implementations private for use by the guarded wrappers.
alter function public.public_job_list(integer,integer) rename to member_job_list_impl;
alter function public.public_job_detail(uuid) rename to member_job_detail_impl;
alter function public.public_job_search(integer,integer,text,text,text,text[],text[],boolean,uuid[]) rename to member_job_search_impl;
revoke all on function public.member_job_list_impl(integer,integer),public.member_job_detail_impl(uuid),public.member_job_search_impl(integer,integer,text,text,text,text[],text[],boolean,uuid[]) from public,anon,authenticated;

create function public.public_job_list(p_offset integer default 0,p_limit integer default 1000)
returns table(id uuid,title text,description text,employer text,location text,posted_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_access_member_insights() and coalesce(auth.role(),'') <> 'service_role' then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
 return query select * from public.member_job_list_impl(p_offset,p_limit);
end $$;
create function public.public_job_detail(p_job_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_access_member_insights() and coalesce(auth.role(),'') <> 'service_role' then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
 return public.member_job_detail_impl(p_job_id);
end $$;
create function public.public_job_search(p_offset integer default 0,p_limit integer default 50,p_query text default '',p_location text default '',p_kind text default null,p_terms text[] default null,p_title_terms text[] default null,p_include_excerpt boolean default false,p_saved_ids uuid[] default null)
returns table(id uuid,title text,description text,employer text,location text,posted_at timestamptz,total bigint)
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.can_access_member_insights() and coalesce(auth.role(),'') <> 'service_role' then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
 return query select * from public.member_job_search_impl(p_offset,p_limit,p_query,p_location,p_kind,p_terms,p_title_terms,p_include_excerpt,p_saved_ids);
end $$;
revoke all on function public.public_job_list(integer,integer),public.public_job_detail(uuid),public.public_job_search(integer,integer,text,text,text,text[],text[],boolean,uuid[]) from public,anon;
grant execute on function public.public_job_list(integer,integer),public.public_job_detail(uuid),public.public_job_search(integer,integer,text,text,text,text[],text[],boolean,uuid[]) to authenticated,service_role;

-- Preserve historical chats for admin; member access requires a current pass.
create or replace function public.chat_can_access(p_thread uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.can_access_member_insights()
 and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null)
 and exists(select 1 from public.chat_threads t where t.id=p_thread and (t.member_id=auth.uid() or public.is_super_admin()));
$$;
create or replace function public.chat_start(p_member uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); target uuid; result uuid;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) or not public.can_access_member_insights() then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
 if public.is_super_admin() then target:=p_member; if target is null or target=uid then raise exception 'CHOOSE_MEMBER' using errcode='22023'; end if;
 else target:=uid; if p_member is not null and p_member<>uid then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if; end if;
 if not exists(select 1 from auth.users where id=target and email_confirmed_at is not null) then raise exception 'MEMBER_UNAVAILABLE' using errcode='22023'; end if;
 insert into public.chat_threads(member_id) values(target) on conflict(member_id) do update set member_id=excluded.member_id returning id into result;
 return result;
end $$;
create or replace function public.chat_inbox() returns table(id uuid,member_id uuid,member_email text,last_message_at timestamptz,unread boolean) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users au where au.id=auth.uid() and au.email_confirmed_at is not null) or not public.can_access_member_insights() then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
 return query select t.id,t.member_id,case when public.is_super_admin() then u.email::text else null end,t.last_message_at,
 coalesce(t.last_message_at > case when public.is_super_admin() then coalesce(t.admin_read_at,'-infinity'::timestamptz) else coalesce(t.member_read_at,'-infinity'::timestamptz) end and lm.sender_id is distinct from auth.uid(),false)
 from public.chat_threads t join auth.users u on u.id=t.member_id
 left join lateral (select m.sender_id from public.chat_messages m where m.thread_id=t.id order by m.created_at desc,m.id desc limit 1) lm on true
 where t.member_id=auth.uid() or public.is_super_admin() order by t.last_message_at desc nulls last,t.created_at desc limit 1000;
end $$;
