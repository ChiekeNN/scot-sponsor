-- The first live snapshot could not be saved. Pause the daily job until the
-- save error is diagnosed and a complete baseline has been verified.
select cron.alter_job(job_id := (select jobid from cron.job where jobname='scotsponsor-register-monitor'), active := false);
