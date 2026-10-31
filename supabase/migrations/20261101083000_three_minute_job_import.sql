-- Keep a single authorised importer on the requested three-minute cadence.
select cron.unschedule(jobid) from cron.job where jobname='scotsponsor-scotland-job-import';
select cron.schedule('scotsponsor-scotland-job-import','*/3 * * * *',$schedule$
 select net.http_post(url := 'https://ybsbeyyiwnhihkodbedv.supabase.co/functions/v1/scotland-job-import',
 headers := jsonb_build_object('Content-Type','application/json','x-job-import-token',(select decrypted_secret from vault.decrypted_secrets where name='scotland_job_import_token')),
 body := '{}'::jsonb, timeout_milliseconds := 55000);
$schedule$);
