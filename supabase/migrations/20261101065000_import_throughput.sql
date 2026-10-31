create or replace function public.scotland_job_import_finish(p_page integer,p_offset integer,p_imported integer,p_result text,p_block_seconds integer default 0) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_page not between 0 and 100 or p_offset not between 0 and 100 or p_imported not between 0 and 30 or p_result not in ('ok','partial','upstream_error','rate_limited','parse_error') then raise exception 'invalid status'; end if;
 update public.scotland_job_import_state set page=p_page,offset_in_page=p_offset,last_finished=clock_timestamp(),last_result=p_result,imported=imported+p_imported,
 blocked_until=case when p_block_seconds>0 then clock_timestamp()+least(greatest(p_block_seconds,1800),86400)*interval '1 second' else null end where id=true;
 if p_result<>'ok' and p_result<>'partial' then update public.partner_job_sync_status set last_attempt=clock_timestamp(),last_error='SYNC_FAILED' where source='myjobscotland'; end if;
end $$;
select cron.unschedule(jobid) from cron.job where jobname='scotsponsor-scotland-job-import';
select cron.schedule('scotsponsor-scotland-job-import','*/2 * * * *',$schedule$
 select net.http_post(url := 'https://ybsbeyyiwnhihkodbedv.supabase.co/functions/v1/scotland-job-import',
 headers := jsonb_build_object('Content-Type','application/json','x-job-import-token',(select decrypted_secret from vault.decrypted_secrets where name='scotland_job_import_token')),
 body := '{}'::jsonb, timeout_milliseconds := 55000);
$schedule$);
