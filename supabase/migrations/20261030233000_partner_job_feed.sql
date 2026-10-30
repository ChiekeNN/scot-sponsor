-- Public, attributed job excerpts only; never applicant information.
create table public.partner_jobs (
 source text not null check(source in ('adzuna','reed')), external_id text not null,
 title text not null, description text not null default '', employer text not null default '',
 location text not null, posted_at timestamptz not null, source_url text not null,
 last_seen timestamptz not null default now(), primary key(source,external_id)
);
create index partner_jobs_recent on public.partner_jobs(posted_at desc);
alter table public.partner_jobs enable row level security;
revoke all on public.partner_jobs from public, anon, authenticated;
grant select on public.partner_jobs to anon, authenticated;
grant all on public.partner_jobs to service_role;
create policy "show recent partner jobs" on public.partner_jobs for select to anon, authenticated
 using (posted_at >= now()-interval '14 days' and posted_at <= now()+interval '1 day' and last_seen >= now()-interval '5 days');
create table public.partner_job_sync_status (source text primary key check(source in ('adzuna','reed')), last_success timestamptz, truncated boolean not null default false, count integer not null default 0);
alter table public.partner_job_sync_status enable row level security;
revoke all on public.partner_job_sync_status from public, anon, authenticated;
grant select on public.partner_job_sync_status to anon, authenticated;
grant all on public.partner_job_sync_status to service_role;
create policy "show partner sync status" on public.partner_job_sync_status for select to anon, authenticated using (true);
insert into public.partner_job_sync_status(source) values ('adzuna'),('reed');
