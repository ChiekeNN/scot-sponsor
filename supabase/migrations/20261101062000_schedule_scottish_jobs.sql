-- Each invocation is independently authorised with a Vault token; no browser secret.
select cron.schedule('scotsponsor-scotland-job-import', '*/3 * * * *', $schedule$
 select net.http_post(
  url := 'https://ybsbeyyiwnhihkodbedv.supabase.co/functions/v1/scotland-job-import',
  headers := jsonb_build_object('Content-Type','application/json','x-job-import-token',(select decrypted_secret from vault.decrypted_secrets where name='scotland_job_import_token')),
  body := '{}'::jsonb, timeout_milliseconds := 55000);
$schedule$);
