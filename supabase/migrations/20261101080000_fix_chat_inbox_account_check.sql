-- Qualify auth columns to avoid ambiguity with the inbox's returned id column.
create or replace function public.chat_inbox() returns table(id uuid,member_id uuid,member_email text,last_message_at timestamptz,unread boolean) language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users au where au.id=auth.uid() and au.email_confirmed_at is not null) then raise exception 'VERIFIED_ACCOUNT_REQUIRED' using errcode='42501'; end if;
 return query select t.id,t.member_id,case when public.is_super_admin() then u.email::text else null end,t.last_message_at,
 coalesce(t.last_message_at > case when public.is_super_admin() then coalesce(t.admin_read_at,'-infinity'::timestamptz) else coalesce(t.member_read_at,'-infinity'::timestamptz) end and lm.sender_id is distinct from auth.uid(),false)
 from public.chat_threads t join auth.users u on u.id=t.member_id
 left join lateral (select m.sender_id from public.chat_messages m where m.thread_id=t.id order by m.created_at desc,m.id desc limit 1) lm on true
 where t.member_id=auth.uid() or public.is_super_admin() order by t.last_message_at desc nulls last,t.created_at desc limit 1000;
end $$;
