-- A single daily scan at 23:00 Africa/Lagos (UTC+1 year-round).
-- Pages are processed sequentially within a scan; no overlapping three-minute jobs.
alter table public.scotland_job_import_state
 add column batch_running boolean not null default false,
 add column batch_started_at timestamptz,
 add column batch_finished_at timestamptz,
 add column batch_result text,
 add column batch_steps integer not null default 0,
 add column daily_start_on date not null default ((clock_timestamp() at time zone 'Africa/Lagos')::date + 1);

create function public.scotland_job_queue_page() returns bigint language sql volatile security definer set search_path='' as $$
 select net.http_post(
  url := 'https://ybsbeyyiwnhihkodbedv.supabase.co/functions/v1/scotland-job-import',
  headers := jsonb_build_object('Content-Type','application/json','x-job-import-token',(select decrypted_secret from vault.decrypted_secrets where name='scotland_job_import_token' limit 1)),
  body := '{}'::jsonb, timeout_milliseconds := 55000);
$$;
revoke all on function public.scotland_job_queue_page() from public,anon,authenticated;

create function public.scotland_job_start_batch(p_kind text) returns text language plpgsql security definer set search_path='' as $$
declare s public.scotland_job_import_state%rowtype;
begin
 if p_kind not in ('daily','backfill') then raise exception 'invalid batch kind'; end if;
 select * into s from public.scotland_job_import_state where id=true for update;
 if p_kind='daily' and (clock_timestamp() at time zone 'Africa/Lagos')::date < s.daily_start_on then return 'not_started_yet'; end if;
 if s.blocked_until is not null and s.blocked_until>clock_timestamp() then return 'source_paused'; end if;
 -- Do not start over a live page. A stranded run can be restarted after 3 minutes.
 if s.last_started is not null and (s.last_finished is null or s.last_finished<s.last_started) and s.last_started>clock_timestamp()-interval '3 minutes' then return 'busy'; end if;
 if s.batch_running and (s.batch_started_at>clock_timestamp()-interval '3 minutes' or s.last_finished>clock_timestamp()-interval '3 minutes') then return 'busy'; end if;
 update public.scotland_job_import_state set page=0,offset_in_page=0,batch_running=true,batch_steps=0,batch_started_at=clock_timestamp(),batch_finished_at=null,batch_result=p_kind where id=true;
 perform public.scotland_job_queue_page();
 return 'started';
end $$;
revoke all on function public.scotland_job_start_batch(text) from public,anon,authenticated;

-- A completed page releases the lease for the next sequential request. Abandoned
-- work still has a 90-second timeout, and the row update serialises claims.
create or replace function public.scotland_job_import_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.scotland_job_import_state%rowtype;
begin
 update public.scotland_job_import_state set last_started=clock_timestamp(),last_result='running'
 where id=true and batch_running and (blocked_until is null or blocked_until<clock_timestamp())
 and (last_started is null or last_finished>=last_started or last_started<clock_timestamp()-interval '90 seconds') returning * into s;
 if not found then return null; end if;
 return jsonb_build_object('page',s.page,'offset',s.offset_in_page);
end $$;

create or replace function public.scotland_job_import_finish(p_page integer,p_offset integer,p_imported integer,p_result text,p_block_seconds integer default 0) returns void language plpgsql security definer set search_path='' as $$
declare s public.scotland_job_import_state%rowtype; complete boolean; why text;
begin
 if p_page not between 0 and 100 or p_offset not between 0 and 100 or p_imported not between 0 and 30 or p_result not in ('ok','partial','upstream_error','rate_limited','parse_error') then raise exception 'invalid status'; end if;
 select * into s from public.scotland_job_import_state where id=true for update;
 -- Never chain an old request which was already running before the migration.
 complete:=s.batch_running and p_page=0 and p_offset=0;
 why:=case when p_result not in ('ok','partial') then p_result when s.batch_steps>=150 then 'scan_limit' when complete and s.page>=100 then 'scan_limit' when complete then 'complete' else null end;
 update public.scotland_job_import_state set page=p_page,offset_in_page=p_offset,last_finished=clock_timestamp(),last_result=p_result,imported=imported+p_imported,
 blocked_until=case when p_block_seconds>0 then clock_timestamp()+greatest(p_block_seconds,1800)*interval '1 second' else null end,
 batch_steps=case when s.batch_running then s.batch_steps+1 else s.batch_steps end,
 batch_running=case when why is not null then false else s.batch_running end,
 batch_finished_at=case when why is not null and s.batch_running then clock_timestamp() else s.batch_finished_at end,
 batch_result=case when why is not null and s.batch_running then why else s.batch_result end where id=true;
 if p_result not in ('ok','partial') then update public.partner_job_sync_status set last_attempt=clock_timestamp(),last_error='SYNC_FAILED' where source='myjobscotland'; end if;
 if s.batch_running and why is null then perform public.scotland_job_queue_page(); end if;
end $$;

-- cron runs in UTC: 22:00 UTC is 23:00 in Lagos. The function skips today.
select cron.unschedule(jobid) from cron.job where jobname='scotsponsor-scotland-job-import';
select cron.schedule('scotsponsor-scotland-job-import','0 22 * * *',$schedule$
 select public.scotland_job_start_batch('daily');
$schedule$);
