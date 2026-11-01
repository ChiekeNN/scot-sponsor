-- Resolve PL/pgSQL variable name collision with auth.users.phone.
create or replace function public.admin_edit_member_profile(p_user uuid,p_first_name text,p_last_name text,p_phone text) returns void language plpgsql security definer set search_path='' as $$
declare f text:=trim(coalesce(p_first_name,'')); l text:=trim(coalesce(p_last_name,'')); v_phone text:=trim(coalesce(p_phone,''));
begin
 if not public.admin_member_target_allowed(p_user) then raise exception 'NOT_AUTHORISED' using errcode='42501'; end if;
 if length(f) not between 1 and 60 or length(l) not between 1 and 60 or length(f||' '||l)>100 or f ~ '[[:cntrl:]]' or l ~ '[[:cntrl:]]' then raise exception 'INVALID_NAME' using errcode='22023'; end if;
 if v_phone<>'' and (length(v_phone)>32 or v_phone !~ '^\+?[0-9 ()-]+$' or length(regexp_replace(v_phone,'[^0-9]','','g')) not between 7 and 15) then raise exception 'INVALID_PHONE' using errcode='22023'; end if;
 update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb)||jsonb_build_object('first_name',f,'last_name',l,'full_name',f||' '||l,'contact_phone',v_phone),updated_at=now() where id=p_user;
 insert into public.member_admin_actions(actor_id,subject_id,action) values(auth.uid(),p_user,'edit_profile');
end $$;
