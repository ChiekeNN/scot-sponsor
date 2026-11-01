-- Independent account suspension preserves entitlements and can be reversed.
create table public.member_account_suspensions(user_id uuid primary key references auth.users(id) on delete cascade, suspended_by uuid not null, suspended_at timestamptz not null default now());
create table public.member_admin_actions(id bigint generated always as identity primary key,actor_id uuid not null,subject_id uuid not null,action text not null,occurred_at timestamptz not null default now());
alter table public.member_account_suspensions enable row level security;
alter table public.member_admin_actions enable row level security;
revoke all on public.member_account_suspensions,public.member_admin_actions from public,anon,authenticated;
grant all on public.member_account_suspensions,public.member_admin_actions to service_role;
grant usage,select on sequence public.member_admin_actions_id_seq to service_role;
create function public.member_account_is_suspended(p_user uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.member_account_suspensions where user_id=p_user);
$$;
revoke all on function public.member_account_is_suspended(uuid) from public,anon,authenticated;

-- Both plan gates enforce suspension even when a previously issued JWT exists.
create or replace function public.has_job_hunt_pass() returns boolean language sql stable security definer set search_path='' as $$
 select not public.member_account_is_suspended(auth.uid()) and exists(select 1 from public.member_entitlements e where e.user_id=auth.uid() and e.plan='job_hunt_pass' and e.starts_at<=now() and e.expires_at>now() and e.revoked_at is null);
$$;
create or replace function public.can_access_job_hunt() returns boolean language sql stable security definer set search_path='' as $$
 select not public.member_account_is_suspended(auth.uid()) and (public.is_super_admin() or public.has_job_hunt_pass());
$$;
create or replace function public.can_access_member_insights() returns boolean language sql stable security definer set search_path='' as $$
 select not public.member_account_is_suspended(auth.uid()) and (public.is_super_admin() or exists(select 1 from public.member_entitlements e where e.user_id=auth.uid() and e.plan in ('job_hunt_pass','monthly_alert_pass') and e.starts_at<=now() and e.expires_at>now() and e.revoked_at is null));
$$;
-- Applications are otherwise open to signed-in non-members; reject suspended
-- accounts even if their old access token has not yet expired.
create function public.reject_suspended_application() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.applicant_id=auth.uid() and public.member_account_is_suspended(new.applicant_id) then raise exception 'ACCOUNT_SUSPENDED' using errcode='42501'; end if;
 return new;
end $$;
revoke all on function public.reject_suspended_application() from public,anon,authenticated;
create trigger suspended_application_guard before insert on public.platform_job_applications for each row execute function public.reject_suspended_application();

create function public.admin_member_target_allowed(p_user uuid) returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 return p_user is not null and p_user<>auth.uid() and exists(select 1 from auth.users u where u.id=p_user) and not exists(select 1 from public.super_admins a where a.user_id=p_user);
end $$;
create function public.admin_member_set_suspension(p_user uuid,p_suspend boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.admin_member_target_allowed(p_user) or p_suspend is null then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_suspend then insert into public.member_account_suspensions(user_id,suspended_by) values(p_user,auth.uid()) on conflict(user_id) do update set suspended_by=excluded.suspended_by,suspended_at=now();
 else delete from public.member_account_suspensions where user_id=p_user; end if;
 insert into public.member_admin_actions(actor_id,subject_id,action) values(auth.uid(),p_user,case when p_suspend then 'suspend' else 'restore' end);
end $$;
create function public.admin_member_record_delete(p_user uuid,p_action text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_action='delete_requested' then
  if not public.admin_member_target_allowed(p_user) then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 elsif p_action='delete_completed' then
  if p_user is null or p_user=auth.uid() or exists(select 1 from public.super_admins where user_id=p_user) or exists(select 1 from auth.users where id=p_user) or not exists(select 1 from public.member_admin_actions where actor_id=auth.uid() and subject_id=p_user and action='delete_requested') then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 else raise exception 'INVALID_REQUEST' using errcode='22023'; end if;
 insert into public.member_admin_actions(actor_id,subject_id,action) values(auth.uid(),p_user,p_action);
end $$;
create function public.admin_edit_member_name(p_user uuid,p_name text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.admin_member_target_allowed(p_user) then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if char_length(trim(coalesce(p_name,''))) not between 2 and 100 then raise exception 'INVALID_NAME' using errcode='22023'; end if;
 update auth.users set raw_user_meta_data=jsonb_set(coalesce(raw_user_meta_data,'{}'::jsonb),'{full_name}',to_jsonb(trim(p_name)),true),updated_at=now() where id=p_user;
 insert into public.member_admin_actions(actor_id,subject_id,action) values(auth.uid(),p_user,'edit_name');
end $$;

-- Paginated, searchable accounts; demo selections are visibly not paid passes.
create function public.admin_member_directory(p_filter text default 'all',p_search text default '',p_offset integer default 0)
returns table(user_id uuid,email text,full_name text,email_confirmed boolean,created_at timestamptz,member_number text,demo_plan text,is_admin boolean,suspended boolean,auth_banned boolean,passes jsonb,total bigint) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_filter is null or p_filter not in ('all','monthly_alert_pass','job_hunt_pass','no_active') or length(coalesce(p_search,''))>200 then raise exception 'INVALID_FILTER' using errcode='22023'; end if;
 return query select u.id,u.email::text,coalesce(u.raw_user_meta_data->>'full_name',''),u.email_confirmed_at is not null,u.created_at,c.member_number,c.demo_plan,exists(select 1 from public.super_admins a where a.user_id=u.id),public.member_account_is_suspended(u.id),coalesce(u.banned_until>now(),false),
 coalesce((select jsonb_agg(jsonb_build_object('plan',e.plan,'starts_at',e.starts_at,'expires_at',e.expires_at,'revoked_at',e.revoked_at) order by e.plan) from public.member_entitlements e where e.user_id=u.id),'[]'::jsonb),count(*) over()
 from auth.users u left join public.member_identity_cards c on c.user_id=u.id
 where (strpos(lower(coalesce(u.email,'')),lower(trim(coalesce(p_search,''))))>0 or strpos(lower(coalesce(u.raw_user_meta_data->>'full_name','')),lower(trim(coalesce(p_search,''))))>0)
 and (p_filter='all' or (p_filter in ('monthly_alert_pass','job_hunt_pass') and (exists(select 1 from public.member_entitlements e where e.user_id=u.id and e.plan=p_filter) or c.demo_plan=p_filter)) or (p_filter='no_active' and not exists(select 1 from public.member_entitlements e where e.user_id=u.id and e.revoked_at is null and e.starts_at<=now() and e.expires_at>now())))
 order by u.created_at desc nulls last,u.id desc offset greatest(coalesce(p_offset,0),0) limit 25;
end $$;
revoke all on function public.admin_member_target_allowed(uuid),public.admin_member_set_suspension(uuid,boolean),public.admin_member_record_delete(uuid,text),public.admin_edit_member_name(uuid,text),public.admin_member_directory(text,text,integer) from public,anon,authenticated;
grant execute on function public.admin_member_target_allowed(uuid),public.admin_member_set_suspension(uuid,boolean),public.admin_member_record_delete(uuid,text),public.admin_edit_member_name(uuid,text),public.admin_member_directory(text,text,integer) to authenticated;
