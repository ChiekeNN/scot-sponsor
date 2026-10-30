# Super-admin register monitoring

The alert centre is separate from member job alerts. No job-board feed, email or push delivery is connected. The Home Office register lists sponsor licences, not vacancies. A name-and-town match does not prove company identity or licence revocation.

## Live status and safeguards

A real Home Office baseline completed successfully on 30 October 2026: 6,458 directory rows, 6,386 matched, and zero change alerts. A simulated single change returned one notification inside a rolled-back transaction; an unauthorised invocation returned 401. The daily `scotsponsor-register-monitor` cron job is active at 18:00 UTC. Its first *scheduled* execution has not yet occurred at the time of this validation. Admins can see the last successful run, errors and a warning when no successful check has occurred for 48 hours. A failed or delayed run is not evidence that there are no changes.

The original save error was PostgreSQL's safe-update protection rejecting an unqualified delete. Migration `20261030223000_fix_register_snapshot_save.sql` removes only snapshots for organisations no longer in the active directory, upserts current records and validates payload completeness and uniqueness. The text-payload RPC wrapper is service-role only.

The scheduler uses a random token generated inside Supabase Vault. The Edge Function validates it with a service-role-only RPC. Keep the token and service credentials out of logs and clients. Supabase `pg_net` may temporarily store request headers in its queue; restrict database access accordingly. Source code is under `supabase/functions/register-monitor/` and must be bundled as one Edge Function when deployed.

Successful checks fetch the current CSV link from the GOV.UK Content API, require an intact download and expected columns, compare exact normalised names and towns, and guard against unusually incomplete data. The first run for a directory version establishes a baseline; subsequent changes are recorded atomically. A missing match may be a name or location change. Only super admins can read and mark notifications.
