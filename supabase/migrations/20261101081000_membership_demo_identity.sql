-- A ScotSponsor member ID identifies an account, not a government ID or proof of identity.
create table public.member_identity_cards (
 user_id uuid primary key references auth.users(id) on delete cascade,
 member_number text not null unique,
 demo_plan text check (demo_plan in ('monthly_alert_pass','job_hunt_pass')),
 created_at timestamptz not null default now()
);
alter table public.member_identity_cards enable row level security;
revoke all on public.member_identity_cards from public, anon, authenticated;
grant all on public.member_identity_cards to service_role;

create function public.ensure_member_number(p_user uuid) returns text language plpgsql security definer set search_path='' as $$
declare result text; candidate text; raw text;
begin
 loop
  select member_number into result from public.member_identity_cards where user_id=p_user;
  if result is not null then return result; end if;
  raw:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,16));
  candidate:='SS-'||substr(raw,1,4)||'-'||substr(raw,5,4)||'-'||substr(raw,9,4)||'-'||substr(raw,13,4);
  begin
   insert into public.member_identity_cards(user_id,member_number) values(p_user,candidate) on conflict(user_id) do nothing;
  exception when unique_violation then null; end;
 end loop;
end $$;
revoke all on function public.ensure_member_number(uuid) from public,anon,authenticated;

-- Demo activation is NOT a payment and never writes a paid entitlement.
create function public.activate_demo_membership(p_plan text) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); number text;
begin
 if uid is null or not exists(select 1 from auth.users u where u.id=uid and u.email_confirmed_at is not null) then raise exception 'VERIFIED_EMAIL_REQUIRED' using errcode='42501'; end if;
 if p_plan is null or p_plan not in ('monthly_alert_pass','job_hunt_pass') then raise exception 'INVALID_PLAN' using errcode='22023'; end if;
 number:=public.ensure_member_number(uid);
 update public.member_identity_cards set demo_plan=p_plan where user_id=uid;
 return jsonb_build_object('member_number',number,'demo_plan',p_plan,'email_verified',true,'is_demo',true);
end $$;

create function public.my_membership_card() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); number text; demo text; admin boolean; active_plans text[];
begin
 if uid is null or not exists(select 1 from auth.users u where u.id=uid and u.email_confirmed_at is not null) then return null; end if;
 admin:=public.is_super_admin();
 select coalesce(array_agg(e.plan order by e.plan),'{}'::text[]) into active_plans from public.member_entitlements e where e.user_id=uid and e.revoked_at is null and e.starts_at<=now() and e.expires_at>now();
 select c.member_number,c.demo_plan into number,demo from public.member_identity_cards c where c.user_id=uid;
 if number is null and (admin or cardinality(active_plans)>0) then number:=public.ensure_member_number(uid); end if;
 if number is null then return null; end if;
 return jsonb_build_object('member_number',number,'demo_plan',demo,'email_verified',true,'is_demo',demo is not null and not admin and cardinality(active_plans)=0,'active_plans',active_plans,'is_admin',admin);
end $$;
revoke all on function public.activate_demo_membership(text),public.my_membership_card() from public,anon;
grant execute on function public.activate_demo_membership(text),public.my_membership_card() to authenticated;
