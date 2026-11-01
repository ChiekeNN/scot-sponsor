-- Contact information is self-reported account metadata; phone is not SMS-verified.
-- Preserve legacy full_name without guessing a first/last split.
create function public.admin_member_directory_v2(p_filter text default 'all',p_search text default '',p_offset integer default 0)
returns setof jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 return query select to_jsonb(d)||jsonb_build_object('first_name',coalesce(u.raw_user_meta_data->>'first_name',''),'last_name',coalesce(u.raw_user_meta_data->>'last_name',''),'phone',coalesce(u.raw_user_meta_data->>'contact_phone',''))
 from public.admin_member_directory(p_filter,p_search,p_offset) d join auth.users u on u.id=d.user_id;
end $$;
create function public.admin_member_detail(p_user uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.is_super_admin() then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 select jsonb_build_object('user_id',u.id,'email',u.email,'full_name',coalesce(u.raw_user_meta_data->>'full_name',''),'first_name',coalesce(u.raw_user_meta_data->>'first_name',''),'last_name',coalesce(u.raw_user_meta_data->>'last_name',''),'phone',coalesce(u.raw_user_meta_data->>'contact_phone',''),'email_confirmed',u.email_confirmed_at is not null,'created_at',u.created_at,'member_number',c.member_number,'demo_plan',c.demo_plan,'is_admin',exists(select 1 from public.super_admins a where a.user_id=u.id),'suspended',public.member_account_is_suspended(u.id),'auth_banned',coalesce(u.banned_until>now(),false),'passes',coalesce((select jsonb_agg(jsonb_build_object('plan',e.plan,'starts_at',e.starts_at,'expires_at',e.expires_at,'revoked_at',e.revoked_at) order by e.plan) from public.member_entitlements e where e.user_id=u.id),'[]'::jsonb)) into result
 from auth.users u left join public.member_identity_cards c on c.user_id=u.id where u.id=p_user;
 if result is null then raise exception 'MEMBER_NOT_FOUND' using errcode='22023'; end if;
 return result;
end $$;
create function public.admin_edit_member_profile(p_user uuid,p_first_name text,p_last_name text,p_phone text) returns void language plpgsql security definer set search_path='' as $$
declare f text:=trim(coalesce(p_first_name,'')); l text:=trim(coalesce(p_last_name,'')); v_phone text:=trim(coalesce(p_phone,''));
begin
 if not public.admin_member_target_allowed(p_user) then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if length(f) not between 1 and 60 or length(l) not between 1 and 60 or length(f||' '||l)>100 or f ~ '[[:cntrl:]]' or l ~ '[[:cntrl:]]' then raise exception 'INVALID_NAME' using errcode='22023'; end if;
 if v_phone<>'' and (length(v_phone)>32 or v_phone !~ '^\+?[0-9 ()-]+$' or length(regexp_replace(v_phone,'[^0-9]','','g')) not between 7 and 15) then raise exception 'INVALID_PHONE' using errcode='22023'; end if;
 update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('first_name',f,'last_name',l,'full_name',f||' '||l,'contact_phone',v_phone),updated_at=now() where id=p_user;
 insert into public.member_admin_actions(actor_id,subject_id,action) values(auth.uid(),p_user,'edit_profile');
end $$;

-- Switch exactly one active pass to the other in a single transaction.
-- Never overwrite an already active target pass or charge/cancel a payment.
create function public.admin_change_member_plan(p_user uuid,p_from text,p_to text,p_expires_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare source_pass public.member_entitlements%rowtype;
begin
 if not public.admin_member_target_allowed(p_user) then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_from is null or p_to is null or p_from not in ('monthly_alert_pass','job_hunt_pass') or p_to not in ('monthly_alert_pass','job_hunt_pass') or p_from=p_to or p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '2 years' then raise exception 'INVALID_PLAN_CHANGE' using errcode='22023'; end if;
 if not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then raise exception 'VERIFIED_ACCOUNT_REQUIRED' using errcode='42501'; end if;
 select * into source_pass from public.member_entitlements where user_id=p_user and plan=p_from for update;
 if not found or source_pass.revoked_at is not null or source_pass.starts_at>now() or source_pass.expires_at<=now() then raise exception 'SOURCE_PASS_INACTIVE' using errcode='22023'; end if;
 insert into public.member_entitlements(user_id,plan,starts_at,expires_at,revoked_at) values(p_user,p_to,now(),p_expires_at,null)
 on conflict(user_id,plan) do update set starts_at=excluded.starts_at,expires_at=excluded.expires_at,revoked_at=null
 where public.member_entitlements.revoked_at is not null or public.member_entitlements.expires_at<=now();
 if not found then raise exception 'TARGET_PASS_ALREADY_ACTIVE' using errcode='22023'; end if;
 update public.member_entitlements set revoked_at=now() where user_id=p_user and plan=p_from;
 insert into public.admin_audit_log(actor_id,subject_id,plan,action,expires_at) values(auth.uid(),p_user,p_from,'revoke',null),(auth.uid(),p_user,p_to,'grant',p_expires_at);
 insert into public.member_admin_actions(actor_id,subject_id,action) values(auth.uid(),p_user,'change_plan');
end $$;
revoke all on function public.admin_member_directory_v2(text,text,integer),public.admin_member_detail(uuid),public.admin_edit_member_profile(uuid,text,text,text),public.admin_change_member_plan(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.admin_member_directory_v2(text,text,integer),public.admin_member_detail(uuid),public.admin_edit_member_profile(uuid,text,text,text),public.admin_change_member_plan(uuid,text,text,timestamptz) to authenticated;

-- Apply the same target protection to the existing manual pass controls.
create or replace function public.admin_set_pass(p_user uuid,p_plan text,p_expires_at timestamptz,p_action text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not public.admin_member_target_allowed(p_user) then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if p_plan is null or p_action is null or p_plan not in ('job_hunt_pass','monthly_alert_pass') or p_action not in ('grant','revoke') then raise exception 'INVALID_REQUEST'; end if;
 if not exists(select 1 from auth.users where id=p_user and email_confirmed_at is not null) then raise exception 'VERIFIED_ACCOUNT_REQUIRED'; end if;
 if p_action='grant' then
  if p_expires_at is null or p_expires_at<=now() or p_expires_at>now()+interval '2 years' then raise exception 'INVALID_EXPIRY'; end if;
  insert into public.member_entitlements(user_id,plan,starts_at,expires_at,revoked_at) values(p_user,p_plan,now(),p_expires_at,null)
  on conflict(user_id,plan) do update set starts_at=excluded.starts_at,expires_at=excluded.expires_at,revoked_at=null;
 else
  update public.member_entitlements set revoked_at=now() where user_id=p_user and plan=p_plan and revoked_at is null;
  if not found then raise exception 'NO_PASS_TO_REVOKE'; end if;
 end if;
 insert into public.admin_audit_log(actor_id,subject_id,plan,action,expires_at) values(auth.uid(),p_user,p_plan,p_action,case when p_action='grant' then p_expires_at else null end);
end $$;
