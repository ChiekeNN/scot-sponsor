-- Member discussion board: direct table access remains closed. Public identities
-- are deliberately generic; administrators can remove and review reports.
create table public.forum_threads(id uuid primary key default gen_random_uuid(), author_id uuid references auth.users(id) on delete set null, title text not null check(char_length(title) between 5 and 160), body text not null check(char_length(body) between 10 and 4000), created_at timestamptz not null default now());
create table public.forum_replies(id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.forum_threads(id) on delete cascade, author_id uuid references auth.users(id) on delete set null, body text not null check(char_length(body) between 2 and 4000), created_at timestamptz not null default now());
create table public.forum_reports(id uuid primary key default gen_random_uuid(), reporter_id uuid references auth.users(id) on delete set null, thread_id uuid references public.forum_threads(id) on delete cascade, reply_id uuid references public.forum_replies(id) on delete cascade, reason text not null check(char_length(reason) between 5 and 500), created_at timestamptz not null default now(), resolved boolean not null default false, check((thread_id is null) <> (reply_id is null)));
create index forum_threads_order on public.forum_threads(created_at desc,id desc);
create index forum_threads_author on public.forum_threads(author_id,created_at desc);
create index forum_replies_order on public.forum_replies(thread_id,created_at,id);
create index forum_replies_author on public.forum_replies(author_id,created_at desc);
create index forum_reports_order on public.forum_reports(resolved,created_at desc);
alter table public.forum_threads enable row level security;
alter table public.forum_replies enable row level security;
alter table public.forum_reports enable row level security;
revoke all on public.forum_threads,public.forum_replies,public.forum_reports from public,anon,authenticated;
grant all on public.forum_threads,public.forum_replies,public.forum_reports to service_role;
create function public.forum_require_access() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_access_member_insights() or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
end $$;
revoke all on function public.forum_require_access() from public,anon,authenticated;
create function public.forum_threads_list(p_offset integer default 0) returns table(id uuid,title text,body text,created_at timestamptz,own boolean,replies bigint) language plpgsql stable security definer set search_path='' as $$
begin
 perform public.forum_require_access();
 return query select t.id,t.title,t.body,t.created_at,t.author_id=auth.uid(),(select count(*) from public.forum_replies r where r.thread_id=t.id) from public.forum_threads t order by t.created_at desc,t.id desc offset least(greatest(coalesce(p_offset,0),0),10000) limit 30;
end $$;
create function public.forum_replies_list(p_thread uuid) returns table(id uuid,body text,created_at timestamptz,own boolean) language plpgsql stable security definer set search_path='' as $$
begin
 perform public.forum_require_access();
 return query select r.id,r.body,r.created_at,r.author_id=auth.uid() from public.forum_replies r where r.thread_id=p_thread order by r.created_at asc,r.id asc limit 200;
end $$;
create function public.forum_create_thread(p_title text,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; uid uuid:=auth.uid();
begin
 perform public.forum_require_access();
 if char_length(trim(coalesce(p_title,''))) not between 5 and 160 or char_length(trim(coalesce(p_body,''))) not between 10 and 4000 then raise exception 'INVALID_CONTENT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||'forum-thread',0));
 if (select count(*) from public.forum_threads where author_id=uid and created_at>now()-interval '1 hour')>=5 then raise exception 'RATE_LIMIT' using errcode='42900'; end if;
 insert into public.forum_threads(author_id,title,body) values(uid,trim(p_title),trim(p_body)) returning id into result; return result;
end $$;
create function public.forum_create_reply(p_thread uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; uid uuid:=auth.uid();
begin
 perform public.forum_require_access();
 if char_length(trim(coalesce(p_body,''))) not between 2 and 4000 then raise exception 'INVALID_CONTENT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||'forum-reply',0));
 if (select count(*) from public.forum_replies where author_id=uid and created_at>now()-interval '1 hour')>=30 then raise exception 'RATE_LIMIT' using errcode='42900'; end if;
 if not exists(select 1 from public.forum_threads where id=p_thread) then raise exception 'THREAD_UNAVAILABLE' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_thread::text||'forum-cap',0));
 if (select count(*) from public.forum_replies where thread_id=p_thread)>=200 then raise exception 'THREAD_FULL' using errcode='22023'; end if;
 insert into public.forum_replies(thread_id,author_id,body) values(p_thread,uid,trim(p_body)) returning id into result; return result;
end $$;
create function public.forum_delete(p_kind text,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.forum_require_access();
 if p_kind='thread' then delete from public.forum_threads where id=p_id and (author_id=auth.uid() or public.is_super_admin());
 elsif p_kind='reply' then delete from public.forum_replies where id=p_id and (author_id=auth.uid() or public.is_super_admin());
 else raise exception 'INVALID_KIND' using errcode='22023'; end if;
 if not found then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
end $$;
create function public.forum_report(p_kind text,p_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.forum_require_access();
 if char_length(trim(coalesce(p_reason,''))) not between 5 and 500 then raise exception 'INVALID_REPORT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'forum-report',0));
 if (select count(*) from public.forum_reports where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'RATE_LIMIT' using errcode='42900'; end if;
 if p_kind='thread' and exists(select 1 from public.forum_threads where id=p_id) then insert into public.forum_reports(reporter_id,thread_id,reason) values(auth.uid(),p_id,trim(p_reason));
 elsif p_kind='reply' and exists(select 1 from public.forum_replies where id=p_id) then insert into public.forum_reports(reporter_id,reply_id,reason) values(auth.uid(),p_id,trim(p_reason));
 else raise exception 'ITEM_UNAVAILABLE' using errcode='22023'; end if;
end $$;
create function public.forum_reports_list() returns table(id uuid,kind text,item_id uuid,reason text,content text,created_at timestamptz) language plpgsql stable security definer set search_path='' as $$
begin
 perform public.forum_require_access(); if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 return query select x.id,case when x.thread_id is not null then 'thread' else 'reply' end,coalesce(x.thread_id,x.reply_id),x.reason,coalesce(t.title||E'\n'||t.body,r.body),x.created_at from public.forum_reports x left join public.forum_threads t on t.id=x.thread_id left join public.forum_replies r on r.id=x.reply_id where not x.resolved order by x.created_at desc limit 100;
end $$;
create function public.forum_resolve_report(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.forum_require_access(); if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 update public.forum_reports set resolved=true where id=p_id;
end $$;
revoke all on function public.forum_threads_list(integer),public.forum_replies_list(uuid),public.forum_create_thread(text,text),public.forum_create_reply(uuid,text),public.forum_delete(text,uuid),public.forum_report(text,uuid,text),public.forum_reports_list(),public.forum_resolve_report(uuid) from public,anon,authenticated;
grant execute on function public.forum_threads_list(integer),public.forum_replies_list(uuid),public.forum_create_thread(text,text),public.forum_create_reply(uuid,text),public.forum_delete(text,uuid),public.forum_report(text,uuid,text),public.forum_reports_list(),public.forum_resolve_report(uuid) to authenticated;
