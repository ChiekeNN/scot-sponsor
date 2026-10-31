# ScotSponsor

A Scotland-focused job discovery prototype, based on the ScotSponsor development brief. It is a React, TypeScript and Vite application with a public demo and a protected directory backed by Supabase.

## Run locally

Requires Node.js 18+ (Node 20 LTS recommended).

```bash
npm install
npm run dev
```

Open the URL printed by Vite. For a production build, run `npm run build`; `npm run preview` serves that build locally. Vite alone does not run Vercel serverless functions, so Companies House and member immigration APIs require a Vercel-compatible deployment or serverless emulator.

## What works

- Visitors first see a public homepage with an introduction, product information, planned pricing and an interactive sponsor-insights section. The insights are transcribed from the supplied “Scotland Licensed Visa Sponsors – Directory & Industry Breakdown” PDF, not a live register. Its snapshot date, filtering and classification methodology are not specified. A licensed sponsor may not sponsor a particular vacancy; check the official UKVI register and ask the employer. They can explore the dashboard and tools in an explicitly labelled demo without an account.
- Supabase accounts route users to their membership dashboard. A verified super administrator can grant and revoke passes manually. No payment information is collected. Alert and membership actions surface the planned subscription options, but do **not** grant paid access.

- Partner job cards are prepared for Adzuna and Reed Scotland searches. These feeds require configuration and a successful initial sync before listings appear. Job excerpts may be incomplete; Scotland-only matching is conservative and may omit jobs. Job details show provider excerpts on-site; sponsorship is not verified. Job Hunt Pass members can request personal support through the private admin inbox.
- Filter by location, category and the sponsorship language in a listing; sort by newest or minimum salary.
- Open job details and save/remove jobs. Saved IDs are stored in the browser's local storage on that device; clearing browser data removes them.
- Explore the public Career Journal and dashboard journal: searchable, topic-filtered editorial guides on job searching, CVs, interviews, sponsorship, relationship breakdown and sponsor-licence loss, with links to official sources. Guides are static editorial content, not a live or automatically updated news feed; readers should check current official information.
- Read a practical guide linking to official UK government sources.
- View the proposed products and prices, and preview the alerts interface.
- A home dashboard with a daily job-search tip, links to tools and a shortlist summary.
- Scottish income tax and employee National Insurance estimator for the **2026–27 tax year**, with a monthly budget planner. It is illustrative and excludes pensions, student loans, other income and tax-code adjustments. It is not tax, financial or immigration advice; verify current rates with [GOV.UK](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027).
- A member-only sponsor directory interface with server-side Supabase RLS, searchable industry/location/route filters and Excel downloads. The approved Supabase project has RLS configured and the 6,458-row private CSV imported, but access requires an active Job Hunt Pass or a super-admin role; see [DIRECTORY_SETUP.md](DIRECTORY_SETUP.md). The supplied directory is an undated snapshot, not live UKVI data.
- A CV studio preview, intended for the Job Hunt Pass: create a structured CV, add multiple experience and education entries, download plain text or print/save as PDF, and compare CV text with a pasted job description. PDF, DOCX and TXT uploads are processed locally (5 MB maximum, 20-page PDF maximum); scanned/image-only PDFs require OCR and are not supported. The checker uses simple word overlap, not an employer ATS or a prediction of outcomes. It does not understand synonyms or document layout; review suggestions for accuracy. CV drafts are stored in browser local storage on this device, while uploaded CV text and job descriptions are kept in memory only. Do not add passport numbers, dates of birth or other sensitive details. Clearing browser data deletes saved drafts.
- Members with an active Monthly Alert Pass or Job Hunt Pass, and super admins, can search official occupation codes and going-rate tables and see GOV.UK change notes. The API checks membership server-side. Fetch and publication dates are displayed, old source pages are flagged, and unavailable or changed sources fail safely. Salary information is illustrative, not a visa or sponsorship decision; healthcare and education roles may use Scotland-specific pay scales.
- Super admins have a private in-app sponsor-register alert centre. The daily Home Office monitor has a verified baseline, but scheduled runs and source availability should be monitored; see [REGISTER_MONITOR_SETUP.md](REGISTER_MONITOR_SETUP.md). No job-board monitoring is connected.
- An application tracker for roles entered by the user, including editable stages, notes and follow-up dates. Tracker data stays in browser local storage; no reminders or cloud syncing are provided. Avoid storing sensitive information.
- Optional PWA installation and cached app shell in production. Installation is never required, the suggestion can be dismissed, and the app does not request notification permission. Browsers control whether they support installation and the native prompt. The app remembers installation or dismissal in the same browser's storage, but cannot reliably detect installation across different browsers, profiles or separately isolated iOS web-app storage. Closing the app and opening the site in a browser returns users to the normal website; uninstall via the device's app controls.
- Responsive layout for mobile and desktop.

Run `npm test` for calculator, CV-checker, directory workbook and policy-structure checks. The service worker is registered only for production builds: test installation and offline behaviour using `npm run build` followed by `npm run preview`, on HTTPS or localhost. The shell and previously cached resources can load offline, but there is no live job data or offline sync. Browser storage can be cleared or unavailable, so it should not be treated as a backup.

## Important limitations

**This is a prototype, not a live job board.** All six jobs and employers in `src/App.tsx` are fictional. Posting times and salaries are illustrative, not live data. Sponsorship labels demonstrate how language in a job description might be shown; they are not UKVI verification, a certificate of sponsorship or a determination of visa eligibility. The app deliberately does not claim that a licensed sponsor will sponsor a specific role. Salary alone cannot establish Skilled Worker eligibility: occupation codes, going rates, individual circumstances and current rules matter.

The directory data is imported in the configured database. Accounts require email verification and passes are currently granted manually. Companies House lookups require a server-only API key and are unavailable until it is configured. The Adzuna/Reed feed is not operational until credentials are configured and a real initial sync is verified. Work Hub is not used. Support requests are stored in a private admin inbox; they are not employer applications. There is no automated employer delivery, application email delivery, job-board alert delivery, checkout, automated paid entitlement provisioning, or downloadable kit. The private register monitor tracks exact name-and-town changes and does not establish company identity or vacancy sponsorship. The alert form is a UI preview only: the email is neither saved nor sent. Pricing is a roadmap, not an operational checkout. Do not advertise this prototype as a verified or production-ready service.

## Path to production

1. Obtain permission and API credentials for job sources; ingest and deduplicate jobs with source URLs, timestamps and expiry handling.
2. Monitor scheduled Home Office checks for failures or delays; add human-reviewed identity reconciliation if appropriate. A register match must not be presented as proof that a specific job sponsors.
3. Store jobs, sponsors and user preferences in a database; add authentication, access controls and a privacy policy. Use server-side secrets and row-level security where appropriate.
4. Classify explicit sponsorship language conservatively; make ambiguous results visible for review. Maintain current occupation and salary rules with qualified legal review, and link to official guidance rather than making individual eligibility decisions.
5. Add Stripe Checkout and verified webhooks for subscription entitlements, cancellations and one-off purchases. Do not trust client-side payment state.
6. Connect opt-in notifications via Telegram or another provider, with unsubscribe, delivery retries, rate limits and monitoring. Only promise delivery times that the system actually meets.
7. Add automated tests, accessibility checks, analytics with consent, error monitoring and deployment configuration before launch.

The app is independent and is not affiliated with the UK Home Office. It does not provide immigration advice.

## Job Hunt member tools and admin intelligence

The Graduate Visa Switch Planner requires an active Job Hunt Pass or super-admin access (verified by the server). It produces suggested dates based on the expiry and optional target submission date; its default 30-day buffer and milestone offsets are planning estimates, not legal deadlines. It does not save dates or send reminders, and users should check the current GOV.UK rules and seek regulated advice where appropriate.

The AI Cover Letter Generator is implemented but **does not generate letters until an AI connection is configured**. It is designed for the OpenAI API; set `OPENAI_API_KEY` as a server-only Vercel environment variable, optionally `OPENAI_MODEL`, then redeploy. Do not use a `VITE_` prefix or share the key in chat. Before enabling, the operator should approve provider terms, privacy handling, model costs and a spending cap. The user must consent before their entered text is sent to OpenAI; the app does not save the inputs or draft. Provider data retention policies apply. Member use is limited to 10 attempts per UTC day (failures can count); super-admin access is not capped. The API validates sessions and Job Hunt entitlements server-side. Review AI output for factual accuracy.

Super-admin analytics use server-side aggregate queries for all current accounts and manually managed entitlements. Active pass counts are not verified payments; revenue and subscription conversions are not available. The Scotland industry and town rankings describe rows in the imported, undated directory snapshot, not live vacancies or market demand. The administrative member list remains limited to its most recent 1,000 account/pass rows. See `20261030230000_admin_analytics_cover_quota.sql` for the new access-controlled RPCs and quota table.


## Scotland partner jobs setup

The Adzuna and Reed API integrations require server-only Vercel Production variables `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `REED_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a strong random `CRON_SECRET`. Never use a `VITE_` prefix or put credentials in chat or Git. The database migration creates a public read-only, 14-day/5-day-freshness-limited feed; all writes use the server-only service key. Configure both provider accounts and commercial usage rights, source attribution and provider rate limits before enabling or relying on the feed. The Reed Scotland search may resolve ambiguously, and strict Scottish-location matching rejects unknown places, so coverage is incomplete. Adzuna returns description excerpts, not full adverts; this limitation must be clear to applicants. Adzuna’s published API terms require a linked Adzuna label on each displayed advert. The user has stated they have aggregation permission; the operator must confirm that its agreement also covers any personal application assistance workflow and commercial use. Results are bounded to 24 pages per source; truncated runs are flagged. The interface loads up to 1,000 jobs per source, 50 at a time. Jobs may close earlier than the 14-day window. No match to a sponsor register proves a vacancy offers sponsorship.

Vercel cron calls the protected sync at 09:00 UTC on Sunday, Monday, Wednesday and Friday. Scheduled runs before 2 November 2026 are skipped. An authorised operator can trigger the initial backfill with `GET /api/cron/sync-partner-jobs` using a bearer `CRON_SECRET` and header `x-initial-sync: 1`; never expose that secret to the browser. If a provider fails or is unconfigured, it does not receive a successful status. Verify the first real provider results, geographic scope, retention and scheduling before advertising the feed as live. Source caches older than five days are hidden.

ScotSponsor application support requests are stored in a private database inbox, visible only to super-admins in the admin console. Only an authenticated Job Hunt Pass member or super-admin with a verified account email may request help; the database validates the job, consent and rate limit. Requests contain the applicant's name, verified email and job snapshot, not a CV or cover letter. They are not sent to an employer or to `applications@scotsponsor.co.uk`, and no email confirmation is sent. A daily database job removes requests older than 90 days. Monitor that job and independently confirm the controller's privacy notice, rights-handling process and legal basis. The automated email provider remains unconfigured.

Super-admins can also use **Sync partner jobs now** on the Jobs page after signing in, without exposing `CRON_SECRET`. This initial/manual sync checks the same production environment variables and server-side admin entitlement. A database-backed 90-second cooldown prevents overlapping scheduled and manual runs. The number imported depends on valid available Scottish jobs and the provider account's quota; 500 cannot be guaranteed. Failure or insufficient results are reported rather than supplemented with invented jobs.
