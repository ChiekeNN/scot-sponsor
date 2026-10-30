create function public.register_monitor_apply_text(p_version uuid, p_url text, p_published timestamptz, p_rows_text text) returns integer language sql security definer set search_path = '' as $$
 select public.register_monitor_apply(p_version,p_url,p_published,p_rows_text::jsonb);
$$;
revoke all on function public.register_monitor_apply_text(uuid,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.register_monitor_apply_text(uuid,text,timestamptz,text) to service_role;
