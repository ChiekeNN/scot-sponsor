# Member-only sponsor directory setup

The app contains a directory interface and a **fail-closed** Supabase integration for the approved `scot-sponsor` project (`ybsbeyyiwnhihkodbedv`). The supplied CSV has been placed outside the repository at `~/scotsponsor-private/Scotland_Licensed_Sponsors_Directory.csv`; it is **not** committed or served as a public asset. Do not move it into `public/`, `src/`, a public storage bucket, or the Git repository. `private-data/` is also ignored as a defensive measure. Browser-visible code contains no directory rows.

The data is an undated user-supplied snapshot, not a live UKVI register. The CSV has 6,458 rows, 13 industry categories and 397 towns. The category methodology and snapshot date were not provided. A sponsor licence does not mean a specific role offers sponsorship. The UI links to the current official register.

## Activation requires approval and configuration

The directory migration was applied to the approved project; RLS and privileges were checked, and all 6,458 CSV rows were imported and activated. An ordered, all-fields fingerprint matched the supplied CSV. An authenticated request without an entitlement could read no directory rows. The approved Vercel homepage is the Auth site URL. The owner has confirmed their account and claimed the super-admin role. Other members require manually granted entitlements.

1. The migration `supabase/migrations/20261030200130_sponsor_directory.sql` has already been applied to the approved project; do not apply it a second time. For any different project, take a backup and apply it through your normal migration process. The migration creates a private entitlement table, versioned directory tables, row-level security (RLS) policies, a read-only facet function, and a service-role-only atomic publication function. Test it in a non-production environment first.
2. The supplied CSV has already been imported. For future replacement imports, in a trusted local/server environment, validate the supplied data without a database:
   ```sh
   node scripts/import-sponsor-directory.mjs ~/scotsponsor-private/Scotland_Licensed_Sponsors_Directory.csv --validate-only
   ```
   Then set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` **only in that trusted environment** and run:
   ```sh
   node scripts/import-sponsor-directory.mjs ~/scotsponsor-private/Scotland_Licensed_Sponsors_Directory.csv
   ```
   The importer stages all rows in a new version, checks the row count, then switches the active version in a single transaction. On failure the previous published version remains active; remove any failed staged version only after investigation. Keep the service-role key secret and **never** place it in `VITE_` variables, client code, Git, or chat.
3. The approved project URL and publishable key are included as public defaults; `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` may override them at build time (see `.env.example`). These are public browser settings, not service-role credentials. The interface supports existing Supabase email/password accounts.
4. Create or invite users through Supabase Auth and create Job Hunt Pass entitlements **only from a trusted server or administrator**. The Auth site URL is set to the project’s Vercel homepage; test confirmation and recovery flows before inviting users. The `member_entitlements` record must reference an existing `auth.users.id`, set `plan = 'job_hunt_pass'`, an appropriate `starts_at` and `expires_at`, and no `revoked_at`. Ordinary authenticated users can read only their own entitlement and cannot write it. RLS requires either an active, unexpired, unrevoked Job Hunt Pass or a server-managed super-admin role for **every** directory and metadata read. Membership expiry and revocation are checked on the server.
5. **Checkout and automated entitlement provisioning are not implemented.** Before selling access, integrate a payment provider with server-side verified webhooks, idempotent fulfilment, entitlement expiry/revocation, refunds and proper operational support. Never grant access based on client-provided payment or plan values.
6. Verify the migration and deployment using real isolated test accounts: signed-out, signed-in without a pass, an active pass, expired and revoked passes. Test direct REST requests, pagination, search and both exports—not just the interface. The local tests check the generated workbook and policy structure, but do not replace database integration/security tests.

## Workbook and privacy

Members can filter by organisation, industry, city/town and visa route; results are paginated. They can download the filtered results or the whole active directory as a genuine `.xlsx` workbook with a frozen header and native Excel filter arrows. All cells are written as strings, not formulas. The application does not cache directory responses in its service worker. Once a member has downloaded a workbook, revocation cannot recall that local file.

The browser supplies a user session to Supabase; no service key is sent to the browser. Local browser storage may contain the authentication session. Sign out on shared devices.

## Manually importing and granting access

For this setup, a private, ready-to-run SQL import was generated and has already been run at `~/scotsponsor-private/ScotSponsor_Import_Directory.sql`. It contains the complete directory and must stay private. For future replacements only, in the approved project's Supabase SQL Editor, paste the replacement file contents into a new query and run it. It inserts a new version and activates it atomically only when all 6,458 records are present. This is an alternative to the service-role import script above; do not run both unless intentionally creating a new version. Verify the result as an administrator:

```sql
select v.record_count as expected, count(d.id) as imported, v.active
from public.sponsor_directory_versions v
left join public.sponsor_directory d on d.version_id = v.id
where v.active
group by v.id, v.record_count, v.active;
```

To grant a 90-day Job Hunt Pass manually, first create an Auth user using a secure onboarding process and verify their email and payment outside the app. Replace the example email below with the verified email. Run this only in the trusted project's SQL Editor:

```sql
do $$
declare member_id uuid;
begin
  if (select count(*) from auth.users where lower(email) = lower('member@example.com')) <> 1 then
    raise exception 'Expected exactly one matching Auth user';
  end if;
  select id into member_id from auth.users where lower(email) = lower('member@example.com');
  insert into public.member_entitlements (user_id, plan, starts_at, expires_at, revoked_at)
  values (member_id, 'job_hunt_pass', now(), now() + interval '90 days', null)
  on conflict (user_id, plan) do update
    set starts_at = excluded.starts_at, expires_at = excluded.expires_at, revoked_at = null;
end; $$;
```

This does not collect or verify payment. It resets the 90-day period if repeated. An administrator can revoke access by setting the matching entitlement's `revoked_at` to `now()`. Keep a separate auditable record of payment and access decisions. Test with approved, expired, revoked and non-member accounts before inviting real customers.

## Accounts, administration and Companies House

The `accounts_and_admin` migration adds a separate verified super-admin role, a one-time email-confirmed bootstrap, monthly and Job Hunt entitlements, and an audit log. The bootstrap was configured for the owner's chosen email and has now been claimed through email confirmation. No default password is created. The owner then signs in and opens **My account → Admin console**. The admin console grants 30-day Monthly Alert or 90-day Job Hunt passes to verified users; grants and revocations are logged. It does not collect, validate or refund payments. Access is enforced by Postgres RLS/functions and can be revoked immediately. Super-admins have non-expiring access to the features of both passes without a membership record. Removing the admin role removes this special access; normal passes remain separately managed.

Company checks search the official Companies House API on demand and require explicit selection of a search result: the supplied sponsor CSV has no company numbers and cannot establish an automatic match. An active Job Hunt Pass or super-admin role is checked on the server on every request. Companies House information is not a financial rating or evidence a particular job offers sponsorship. Missing or incomplete charge data is shown as unavailable, not zero. SIC codes can be looked up in the official linked classification.

To enable company lookups in Vercel, create an API key at the [Companies House developer portal](https://developer.company-information.service.gov.uk/get-started), and add it as the **server-side** environment variable `COMPANIES_HOUSE_API_KEY` in the Vercel project settings for the appropriate environment. Redeploy afterwards. Never use a `VITE_` prefix, embed this key in client code, put it in Git, or send it in chat. Companies House imposes [rate limits](https://developer.company-information.service.gov.uk/developer-guidelines); monitor usage and add shared rate limiting/caching before wider release. Until the key is configured, the endpoint returns an unavailable message and does not fabricate data.

Authentication emails, invitations and password resets require an appropriately configured Supabase production site URL and email service. Supabase's default email service is rate-limited and intended for testing. Configure a custom SMTP provider and test confirmation and recovery before onboarding customers. Before launch, perform end-to-end access tests with separate super-admin, non-member, active monthly, active Job Hunt, expired and revoked test accounts. See the test suite for mocked server-side access and Companies House cases; it is not a substitute for production integration/security testing.
