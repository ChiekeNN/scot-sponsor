-- Older discussions were mixed-plan; preserve them in a super-admin-only
-- archive rather than guessing which membership should see their contents.
alter table public.forum_threads add column plan text check(plan in ('monthly_alert_pass','job_hunt_pass'));
create index forum_threads_plan_order on public.forum_threads(plan,created_at desc,id desc);

create function public.forum_available_plans() returns table(plan text) language plpgsql stable security definer set search_path='' as $$
begin
 perform public.forum_require_access();
 return query select p.plan from (values ('monthly_alert_pass'::text),('job_hunt_pass'::text)) as p(plan)
 where public.is_super_admin() or exists(select 1 from public.member_entitlements e where e.user_id=auth.uid() and e.plan=p.plan and e.starts_at<=now() and e.expires_at>now() and e.revoked_at is null);
end $$;
create function public.forum_can_view_thread(p_thread uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.forum_threads t where t.id=p_thread and (public.is_super_admin() or (t.plan is not null and exists(select 1 from public.member_entitlements e where e.user_id=auth.uid() and e.plan=t.plan and e.starts_at<=now() and e.expires_at>now() and e.revoked_at is null))));
$$;
revoke all on function public.forum_can_view_thread(uuid) from public,anon,authenticated;

create function public.forum_plan_threads_list(p_plan text,p_offset integer default 0) returns table(id uuid,title text,body text,created_at timestamptz,own boolean,replies bigint) language plpgsql stable security definer set search_path='' as $$
begin
 perform public.forum_require_access();
 if p_plan='archive' then
  if not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 elsif p_plan is null or not exists(select 1 from public.forum_available_plans() p where p.plan=p_plan) then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 return query select t.id,t.title,t.body,t.created_at,t.author_id=auth.uid(),(select count(*) from public.forum_replies r where r.thread_id=t.id) from public.forum_threads t
 where (p_plan='archive' and t.plan is null) or t.plan=p_plan order by t.created_at desc,t.id desc offset least(greatest(coalesce(p_offset,0),0),10000) limit 30;
end $$;
create function public.forum_plan_create_thread(p_plan text,p_title text,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; uid uuid:=auth.uid();
begin
 perform public.forum_require_access();
 if p_plan is null or not exists(select 1 from public.forum_available_plans() p where p.plan=p_plan) then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if char_length(trim(coalesce(p_title,''))) not between 5 and 160 or char_length(trim(coalesce(p_body,''))) not between 10 and 4000 then raise exception 'INVALID_CONTENT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||'forum-thread',0));
 if (select count(*) from public.forum_threads where author_id=uid and created_at>now()-interval '1 hour')>=5 then raise exception 'RATE_LIMIT' using errcode='42900'; end if;
 insert into public.forum_threads(author_id,title,body,plan) values(uid,trim(p_title),trim(p_body),p_plan) returning id into result; return result;
end $$;
-- Disable legacy, unsegmented entry points even for stale clients.
revoke all on function public.forum_threads_list(integer),public.forum_create_thread(text,text) from public,anon,authenticated;
revoke all on function public.forum_available_plans(),public.forum_plan_threads_list(text,integer),public.forum_plan_create_thread(text,text,text) from public,anon,authenticated;
grant execute on function public.forum_available_plans(),public.forum_plan_threads_list(text,integer),public.forum_plan_create_thread(text,text,text) to authenticated;

create or replace function public.forum_replies_list(p_thread uuid) returns table(id uuid,body text,created_at timestamptz,own boolean) language plpgsql stable security definer set search_path='' as $$
begin
 perform public.forum_require_access();
 if not public.forum_can_view_thread(p_thread) then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 return query select r.id,r.body,r.created_at,r.author_id=auth.uid() from public.forum_replies r where r.thread_id=p_thread order by r.created_at asc,r.id asc limit 200;
end $$;
create or replace function public.forum_create_reply(p_thread uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare result uuid; uid uuid:=auth.uid();
begin
 perform public.forum_require_access();
 if not public.forum_can_view_thread(p_thread) or not exists(select 1 from public.forum_threads where id=p_thread and plan is not null) then raise exception 'THREAD_UNAVAILABLE' using errcode='42501'; end if;
 if char_length(trim(coalesce(p_body,''))) not between 2 and 4000 then raise exception 'INVALID_CONTENT' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text||'forum-reply',0));
 if (select count(*) from public.forum_replies where author_id=uid and created_at>now()-interval '1 hour')>=30 then raise exception 'RATE_LIMIT' using errcode='42900'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_thread::text||'forum-cap',0));
 if (select count(*) from public.forum_replies where thread_id=p_thread)>=200 then raise exception 'THREAD_FULL' using errcode='22023'; end if;
 insert into public.forum_replies(thread_id,author_id,body) values(p_thread,uid,trim(p_body)) returning id into result; return result;
end $$;
create or replace function public.forum_delete(p_kind text,p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare thread_id uuid;
begin
 perform public.forum_require_access();
 if p_kind='thread' then thread_id:=p_id;
 elsif p_kind='reply' then select r.thread_id into thread_id from public.forum_replies r where r.id=p_id;
 else raise exception 'INVALID_KIND' using errcode='22023'; end if;
 if thread_id is null or not public.forum_can_view_thread(thread_id) then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_kind='thread' then delete from public.forum_threads where id=p_id and (author_id=auth.uid() or public.is_super_admin());
 else delete from public.forum_replies where id=p_id and (author_id=auth.uid() or public.is_super_admin()); end if;
 if not found then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
end $$;
create or replace function public.forum_report(p_kind text,p_id uuid,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare thread_id uuid;
begin
 perform public.forum_require_access();
 if char_length(trim(coalesce(p_reason,''))) not between 5 and 500 then raise exception 'INVALID_REPORT' using errcode='22023'; end if;
 if p_kind='thread' then thread_id:=p_id;
 elsif p_kind='reply' then select r.thread_id into thread_id from public.forum_replies r where r.id=p_id;
 else raise exception 'ITEM_UNAVAILABLE' using errcode='22023'; end if;
 if thread_id is null or not public.forum_can_view_thread(thread_id) then raise exception 'ITEM_UNAVAILABLE' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'forum-report',0));
 if (select count(*) from public.forum_reports where reporter_id=auth.uid() and created_at>now()-interval '1 hour')>=20 then raise exception 'RATE_LIMIT' using errcode='42900'; end if;
 if p_kind='thread' then insert into public.forum_reports(reporter_id,thread_id,reason) values(auth.uid(),p_id,trim(p_reason));
 else insert into public.forum_reports(reporter_id,reply_id,reason) values(auth.uid(),p_id,trim(p_reason)); end if;
end $$;
