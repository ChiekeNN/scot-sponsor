alter table public.partner_job_sync_status add column last_attempt timestamptz, add column last_error text check (last_error in ('NOT_CONFIGURED','SYNC_FAILED'));
