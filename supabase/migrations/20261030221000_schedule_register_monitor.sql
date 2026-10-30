-- Run once a day at 18:00 UTC. Credentials stay in Supabase Vault, not source.
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
select cron.schedule('scotsponsor-register-monitor', '0 18 * * *', $schedule$
  select net.http_post(
    url := 'https://ybsbeyyiwnhihkodbedv.supabase.co/functions/v1/register-monitor',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-monitor-token', (select decrypted_secret from vault.decrypted_secrets where name='register_monitor_token')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$schedule$);
