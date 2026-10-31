-- Community-only moderation: no effect on platform accounts, payments or chat.
create table public.forum_member_restrictions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 status text not null check (status in ('banned','removed')),
 changed_by uuid not null, changed_at timestamptz not null default now()
);
create table public.forum_moderation_audit (
 id bigint generated always as identity primary key,
 actor_id uuid not null, subject_id uuid not null,
 action text not null check (action in ('ban','remove','restore')),
 occurred_at timestamptz not null default now()
);
alter table public.forum_member_restrictions enable row level security;
alter table public.forum_moderation_audit enable row level security;
revoke all on public.forum_member_restrictions,public.forum_moderation_audit from public,anon,authenticated;
grant all on public.forum_member_restrictions,public.forum_moderation_audit to service_role;
grant usage,select on sequence public.forum_moderation_audit_id_seq to service_role;

-- Removed members cannot read the community. Banned members may read, but
-- inserts are rejected by a database trigger even if a client bypasses the UI.
create or replace function public.forum_require_access() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_access_member_insights() or not exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null) then raise exception 'ACTIVE_MEMBERSHIP_REQUIRED' using errcode='42501'; end if;
 if exists(select 1 from public.forum_member_restrictions where user_id=auth.uid() and status='removed') then raise exception 'COMMUNITY_REMOVED' using errcode='42501'; end if;
end $$;
create function public.forum_guard_post() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.author_id is null or new.author_id is distinct from auth.uid() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.author_id::text||'forum-moderation',0));
 if exists(select 1 from public.forum_member_restrictions where user_id=new.author_id) then raise exception 'COMMUNITY_POSTING_RESTRICTED' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.forum_guard_post() from public,anon,authenticated;
create trigger forum_threads_guard before insert on public.forum_threads for each row execute function public.forum_guard_post();
create trigger forum_replies_guard before insert on public.forum_replies for each row execute function public.forum_guard_post();

-- Only administrators can see member identities, search them or take action.
create function public.forum_admin_members(p_search text default '',p_offset integer default 0)
returns table(user_id uuid,email text,status text,is_admin boolean) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 return query select u.id,u.email::text,coalesce(r.status,'active'),exists(select 1 from public.super_admins a where a.user_id=u.id)
 from auth.users u left join public.forum_member_restrictions r on r.user_id=u.id
 where u.email_confirmed_at is not null and strpos(lower(coalesce(u.email,'')),lower(left(coalesce(p_search,''),254)))>0
 order by u.created_at desc,u.id desc offset least(greatest(coalesce(p_offset,0),0),10000) limit 50;
end $$;
create function public.forum_admin_moderate_member(p_user uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_user is null or p_action not in ('ban','remove','restore') or p_action is null then raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
 if not exists(select 1 from auth.users where id=p_user) or exists(select 1 from public.super_admins where user_id=p_user) then raise exception 'INVALID_MEMBER' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_user::text||'forum-moderation',0));
 if p_action='restore' then
   delete from public.forum_member_restrictions where user_id=p_user;
 else
   insert into public.forum_member_restrictions(user_id,status,changed_by) values(p_user,case when p_action='ban' then 'banned' else 'removed' end,auth.uid())
   on conflict(user_id) do update set status=excluded.status,changed_by=excluded.changed_by,changed_at=now();
   if p_action='remove' then
     delete from public.forum_threads where author_id=p_user;
     delete from public.forum_replies where author_id=p_user;
   end if;
 end if;
 insert into public.forum_moderation_audit(actor_id,subject_id,action) values(auth.uid(),p_user,p_action);
end $$;
revoke all on function public.forum_admin_members(text,integer),public.forum_admin_moderate_member(uuid,text) from public,anon,authenticated;
grant execute on function public.forum_admin_members(text,integer),public.forum_admin_moderate_member(uuid,text) to authenticated;

-- Reporting is also community participation; blocked users cannot create reports.
create function public.forum_guard_report() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.reporter_id is null or new.reporter_id is distinct from auth.uid() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.reporter_id::text||'forum-moderation',0));
 if exists(select 1 from public.forum_member_restrictions where user_id=new.reporter_id) then raise exception 'COMMUNITY_POSTING_RESTRICTED' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.forum_guard_report() from public,anon,authenticated;
create trigger forum_reports_guard before insert on public.forum_reports for each row execute function public.forum_guard_report();

-- Identities stay anonymous to members; admins may look up a specific author.
create function public.forum_admin_author(p_kind text,p_id uuid)
returns table(user_id uuid,email text,status text,is_admin boolean) language plpgsql stable security definer set search_path='' as $$
declare author uuid;
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_kind='thread' then select t.author_id into author from public.forum_threads t where t.id=p_id;
 elsif p_kind='reply' then select r.author_id into author from public.forum_replies r where r.id=p_id;
 else raise exception 'INVALID_KIND' using errcode='22023'; end if;
 return query select u.id,u.email::text,coalesce(r.status,'active'),exists(select 1 from public.super_admins a where a.user_id=u.id)
 from auth.users u left join public.forum_member_restrictions r on r.user_id=u.id where u.id=author;
end $$;
revoke all on function public.forum_admin_author(text,uuid) from public,anon,authenticated;
grant execute on function public.forum_admin_author(text,uuid) to authenticated;
