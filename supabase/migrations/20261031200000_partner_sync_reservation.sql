-- Shared cooldown prevents overlapping manual and scheduled imports from exhausting provider quotas.
create table public.partner_job_sync_lock (id boolean primary key default true check (id), last_started timestamptz not null);
alter table public.partner_job_sync_lock enable row level security;
revoke all on public.partner_job_sync_lock from public, anon, authenticated;
grant all on public.partner_job_sync_lock to service_role;
insert into public.partner_job_sync_lock(id,last_started) values (true, '-infinity');
create function public.reserve_partner_job_sync() returns boolean language plpgsql security definer set search_path = '' as $$
declare reserved boolean;
begin
 update public.partner_job_sync_lock set last_started=clock_timestamp() where id=true and last_started < clock_timestamp()-interval '90 seconds' returning true into reserved;
 return coalesce(reserved,false);
end;
$$;
revoke all on function public.reserve_partner_job_sync() from public, anon, authenticated;
grant execute on function public.reserve_partner_job_sync() to service_role;
