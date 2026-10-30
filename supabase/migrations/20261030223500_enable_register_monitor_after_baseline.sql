-- Enable only after a real successful baseline and a rolled-back change test.
select cron.alter_job(job_id := (select jobid from cron.job where jobname='scotsponsor-register-monitor'), active := true);
