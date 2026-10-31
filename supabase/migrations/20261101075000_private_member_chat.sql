-- One private support conversation per verified member, shared with super-admins.
create table public.chat_threads (
 id uuid primary key default gen_random_uuid(), member_id uuid not null unique references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(), last_message_at timestamptz, member_read_at timestamptz, admin_read_at timestamptz
);
create table public.chat_messages (
 id uuid primary key, thread_id uuid not null references public.chat_threads(id) on delete cascade,
 sender_id uuid references auth.users(id) on delete set null, body text not null default '',
 created_at timestamptz not null default clock_timestamp(), edited_at timestamptz, deleted_at timestamptz
);
create index chat_messages_thread_order on public.chat_messages(thread_id,created_at desc,id desc);
create index chat_messages_sender_time on public.chat_messages(sender_id,created_at desc);
create table public.chat_attachments (
 message_id uuid primary key references public.chat_messages(id) on delete cascade,
 name text not null, mime text not null, content bytea not null
);
create table public.chat_reactions (
 message_id uuid not null references public.chat_messages(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 emoji text not null check(emoji in ('👍','❤️','🎉','😊')),
 primary key(message_id,user_id,emoji)
);
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_attachments enable row level security;
alter table public.chat_reactions enable row level security;
revoke all on public.chat_threads,public.chat_messages,public.chat_attachments,public.chat_reactions from public,anon,authenticated;
grant all on public.chat_threads,public.chat_messages,public.chat_attachments,public.chat_reactions to service_role;

create function public.chat_can_access(p_thread uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null)
 and exists(select 1 from public.chat_threads t where t.id=p_thread and (t.member_id=auth.uid() or public.is_super_admin()));
$$;
revoke all on function public.chat_can_access(uuid) from public,anon,authenticated;

create function public.chat_start(p_member uuid default null) returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); target uuid; result uuid;
begin
 if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'VERIFIED_ACCOUNT_REQUIRED' using errcode='42501'; end if;
 if public.is_super_admin() then target:=p_member; if target is null or target=uid then raise exception 'CHOOSE_MEMBER' using errcode='22023'; end if;
 else target:=uid; if p_member is not null and p_member<>uid then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if; end if;
 if not exists(select 1 from auth.users where id=target and email_confirmed_at is not null) then raise exception 'MEMBER_UNAVAILABLE' using errcode='22023'; end if;
 insert into public.chat_threads(member_id) values(target) on conflict(member_id) do update set member_id=excluded.member_id returning id into result;
 return result;
end $$;

create function public.chat_admin_users(p_search text default '') returns table(id uuid,email text) language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if char_length(coalesce(p_search,''))>200 then raise exception 'INVALID_SEARCH' using errcode='22023'; end if;
 return query select u.id,u.email::text from auth.users u where u.email_confirmed_at is not null and u.id<>auth.uid() and position(lower(trim(coalesce(p_search,''))) in lower(u.email))>0 order by u.email limit 50;
end $$;

create function public.chat_inbox() returns table(id uuid,member_id uuid,member_email text,last_message_at timestamptz,unread boolean) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users au where au.id=auth.uid() and au.email_confirmed_at is not null) then raise exception 'VERIFIED_ACCOUNT_REQUIRED' using errcode='42501'; end if;
 return query select t.id,t.member_id,case when public.is_super_admin() then u.email::text else null end,t.last_message_at,
 coalesce(t.last_message_at > case when public.is_super_admin() then coalesce(t.admin_read_at,'-infinity'::timestamptz) else coalesce(t.member_read_at,'-infinity'::timestamptz) end and lm.sender_id is distinct from auth.uid(),false)
 from public.chat_threads t join auth.users u on u.id=t.member_id
 left join lateral (select m.sender_id from public.chat_messages m where m.thread_id=t.id order by m.created_at desc,m.id desc limit 1) lm on true
 where t.member_id=auth.uid() or public.is_super_admin() order by t.last_message_at desc nulls last,t.created_at desc limit 1000;
end $$;

create function public.chat_messages_page(p_thread uuid,p_before_time timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.chat_can_access(p_thread) then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if (p_before_time is null)<>(p_before_id is null) then raise exception 'INVALID_CURSOR' using errcode='22023'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'sender_id',q.sender_id,'body',q.body,'created_at',q.created_at,'edited_at',q.edited_at,'deleted_at',q.deleted_at,'attachment_name',a.name,
 'reactions',coalesce((select jsonb_agg(jsonb_build_object('emoji',r.emoji,'count',r.n,'mine',r.mine) order by r.emoji) from (select cr.emoji,count(*) n,bool_or(cr.user_id=auth.uid()) mine from public.chat_reactions cr where cr.message_id=q.id group by cr.emoji) r),'[]'::jsonb)) order by q.created_at desc,q.id desc),'[]'::jsonb) into result
 from (select m.* from public.chat_messages m where m.thread_id=p_thread and (p_before_time is null or (m.created_at,m.id)<(p_before_time,p_before_id)) order by m.created_at desc,m.id desc limit 50) q
 left join public.chat_attachments a on a.message_id=q.id;
 return result;
end $$;

create function public.chat_send(p_thread uuid,p_id uuid,p_body text,p_name text default null,p_mime text default null,p_base64 text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); bytes bytea; body_text text:=trim(coalesce(p_body,''));
begin
 if not public.chat_can_access(p_thread) then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_id is null or length(body_text)>4000 then raise exception 'INVALID_MESSAGE' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,751));
 if exists(select 1 from public.chat_messages where id=p_id and thread_id=p_thread and sender_id=uid) then return p_id; end if;
 if (select count(*) from public.chat_messages where sender_id=uid and created_at>now()-interval '1 minute')>=30 then raise exception 'RATE_LIMIT' using errcode='22023'; end if;
 if p_base64 is null then
  if p_name is not null or p_mime is not null or length(body_text)=0 then raise exception 'INVALID_MESSAGE' using errcode='22023'; end if;
 else
  if p_name is null or length(p_name) not between 1 and 160 or p_name ~ '[\\/[:cntrl:]]' or length(p_base64)>2796204 or p_mime is null or not ((p_mime='application/pdf' and p_name ~* '[.]pdf$') or (p_mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document' and p_name ~* '[.]docx$') or (p_mime='text/plain' and p_name ~* '[.]txt$')) then raise exception 'INVALID_ATTACHMENT' using errcode='22023'; end if;
  begin bytes:=decode(p_base64,'base64'); exception when others then raise exception 'INVALID_ATTACHMENT' using errcode='22023'; end;
  if octet_length(bytes) not between 1 and 2097152 or (p_mime='application/pdf' and substring(bytes from 1 for 5)<>decode('255044462d','hex')) or (p_mime='application/vnd.openxmlformats-officedocument.wordprocessingml.document' and substring(bytes from 1 for 4)<>decode('504b0304','hex')) then raise exception 'INVALID_ATTACHMENT' using errcode='22023'; end if;
 end if;
 insert into public.chat_messages(id,thread_id,sender_id,body) values(p_id,p_thread,uid,body_text);
 if bytes is not null then insert into public.chat_attachments(message_id,name,mime,content) values(p_id,p_name,p_mime,bytes); end if;
 update public.chat_threads set last_message_at=clock_timestamp() where id=p_thread;
 return p_id;
end $$;

create function public.chat_edit(p_message uuid,p_body text) returns void language plpgsql security definer set search_path='' as $$
declare m public.chat_messages%rowtype; v text:=trim(coalesce(p_body,''));
begin
 select * into m from public.chat_messages where id=p_message for update;
 if not found or not public.chat_can_access(m.thread_id) or m.sender_id is distinct from auth.uid() or m.deleted_at is not null then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if length(v)>4000 or (length(v)=0 and not exists(select 1 from public.chat_attachments where message_id=m.id)) then raise exception 'INVALID_MESSAGE' using errcode='22023'; end if;
 update public.chat_messages set body=v,edited_at=clock_timestamp() where id=m.id;
end $$;
create function public.chat_delete(p_message uuid) returns void language plpgsql security definer set search_path='' as $$
declare m public.chat_messages%rowtype;
begin
 select * into m from public.chat_messages where id=p_message for update;
 if not found or not public.chat_can_access(m.thread_id) or m.sender_id is distinct from auth.uid() or m.deleted_at is not null then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 update public.chat_messages set body='',deleted_at=clock_timestamp() where id=m.id;
 delete from public.chat_attachments where message_id=m.id; delete from public.chat_reactions where message_id=m.id;
end $$;
create function public.chat_react(p_message uuid,p_emoji text) returns void language plpgsql security definer set search_path='' as $$
declare m public.chat_messages%rowtype;
begin
 select * into m from public.chat_messages where id=p_message for update;
 if not found or not public.chat_can_access(m.thread_id) or m.deleted_at is not null then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_emoji is null or p_emoji not in ('👍','❤️','🎉','😊') then raise exception 'INVALID_REACTION' using errcode='22023'; end if;
 delete from public.chat_reactions where message_id=m.id and user_id=auth.uid() and emoji=p_emoji;
 if not found then insert into public.chat_reactions(message_id,user_id,emoji) values(m.id,auth.uid(),p_emoji); end if;
end $$;
create function public.chat_download(p_message uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare m public.chat_messages%rowtype; result jsonb;
begin
 select * into m from public.chat_messages where id=p_message;
 if not found or not public.chat_can_access(m.thread_id) or m.deleted_at is not null then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 select jsonb_build_object('name',a.name,'mime',a.mime,'data',encode(a.content,'base64')) into result from public.chat_attachments a where a.message_id=m.id;
 if result is null then raise exception 'NOT_FOUND' using errcode='22023'; end if;
 return result;
end $$;
create function public.chat_mark_read(p_thread uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.chat_can_access(p_thread) then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if public.is_super_admin() then update public.chat_threads set admin_read_at=clock_timestamp() where id=p_thread;
 else update public.chat_threads set member_read_at=clock_timestamp() where id=p_thread; end if;
end $$;
revoke all on function public.chat_start(uuid),public.chat_admin_users(text),public.chat_inbox(),public.chat_messages_page(uuid,timestamptz,uuid),public.chat_send(uuid,uuid,text,text,text,text),public.chat_edit(uuid,text),public.chat_delete(uuid),public.chat_react(uuid,text),public.chat_download(uuid),public.chat_mark_read(uuid) from public,anon;
grant execute on function public.chat_start(uuid),public.chat_admin_users(text),public.chat_inbox(),public.chat_messages_page(uuid,timestamptz,uuid),public.chat_send(uuid,uuid,text,text,text,text),public.chat_edit(uuid,text),public.chat_delete(uuid),public.chat_react(uuid,text),public.chat_download(uuid),public.chat_mark_read(uuid) to authenticated;
