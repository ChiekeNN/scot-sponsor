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

- Browse recent Scottish jobs from the homepage by industry, popular role or location. Links open the on-site feed with a clearable keyword filter and can be shared or reopened; they search available complete listings on the server, not a comprehensive provider classification. Industry and popular searches use job titles, except that “No Experience” and “Flexible” also search the available excerpt. Results may overlap, omit relevant roles or require confirmation.
- Scottish job cards show short previews and open on-site detail dialogs. Only listings with a current matching full description are public. Source provenance is retained internally; original advert and attachment links are not displayed in the job detail view. A scheduled importer collects complete Scottish local-authority adverts from myjobscotland and checks their source dates and location; availability and coverage depend on the source. Sponsorship arrangements should be confirmed with the employer.
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
- The on-site application form records a verified-account applicant’s name, optional note, account email and PDF/DOCX CV (up to 2 MB) privately in Supabase. It does not send applications to employers or email. Super-admins can view, download, edit applicant details, suspend/reactivate or delete submissions and CVs in the admin console; CVs are untrusted and should be scanned before opening. Records persist until an admin deletes them or the account is deleted. The database limits applications to ten per account per day and one per job. No paid pass is required.
- Private text-only chat connects verified-account visitors and members to the super-admin team. Messages update by polling every few seconds and unread conversations are indicated in-app; there are no voice or video calls, email alerts, or delivery/read guarantees. Each account has one conversation. Both sides can send text and one PDF, DOCX or TXT attachment per message (maximum 2 MB), react, edit or delete their own messages; deleting a message also deletes its attachment. Super-admins can search verified accounts and view their conversations. Files are not virus-scanned: scan downloads before opening. Conversations are stored in Supabase until the account is deleted; individual messages may be deleted by their sender. This is not end-to-end encrypted.
- An application tracker for roles entered by the user, including editable stages, notes and follow-up dates. Tracker data stays in browser local storage; no reminders or cloud syncing are provided. Avoid storing sensitive information.
- Optional PWA installation and cached app shell in production. Installation is never required, the suggestion can be dismissed, and the app does not request notification permission. Browsers control whether they support installation and the native prompt. The app remembers installation or dismissal in the same browser's storage, but cannot reliably detect installation across different browsers, profiles or separately isolated iOS web-app storage. Closing the app and opening the site in a browser returns users to the normal website; uninstall via the device's app controls.
- Responsive layout for mobile and desktop.

Run `npm test` for calculator, CV-checker, directory workbook and policy-structure checks. The service worker is registered only for production builds: test installation and offline behaviour using `npm run build` followed by `npm run preview`, on HTTPS or localhost. The shell and previously cached resources can load offline, but there is no live job data or offline sync. Browser storage can be cleared or unavailable, so it should not be treated as a backup.

## Important limitations

**Public jobs require a current, matching complete description.** Incomplete source records remain private so they can be enriched later; they are not returned by the public listing or detail functions. Imported full descriptions must match the current listing fingerprint, and provider descriptions expire after seven days without refresh. A changed source snippet, expired vacancy or stale feed can hide an otherwise complete job. The scheduled worker fetches source adverts directly and fails closed when details cannot be validated. Saved jobs use opaque IDs on the visitor’s device and show only jobs still available in the complete-only feed. Historic demo saves are left untouched but no longer displayed. A sponsor licence or salary does not establish that a particular role offers sponsorship or that a person is eligible for a visa.

The directory data is imported in the configured database. Accounts require email verification and passes are currently granted manually. Companies House lookups require a server-only API key and are unavailable until it is configured. The Scottish job importer runs on a schedule; coverage is partial and depends on the source. Work Hub is not used. Previously submitted support requests remain in a private admin inbox; they are not employer applications. The previous personal support form remains removed. A separate on-site application and CV form records submissions privately for admin review, without sending them to employers. There is no automated employer delivery, application email delivery, job-board alert delivery, checkout, automated paid entitlement provisioning, or downloadable kit. The private register monitor tracks exact name-and-town changes and does not establish company identity or vacancy sponsorship. The alert form is a UI preview only: the email is neither saved nor sent. Pricing is a roadmap, not an operational checkout. Do not advertise this prototype as a verified or production-ready service.

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

The former Reed and Adzuna integrations have been removed. Their dedicated `REED_API_KEY`, `ADZUNA_APP_ID` and `ADZUNA_APP_KEY` Vercel variables can be removed after deployment. Keep shared `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET` and public Supabase variables where used by other features. Historic private support requests remain subject to their existing retention policy.

The scheduled myjobscotland importer uses public council job pages and retains source provenance internally. It runs every two minutes via Supabase cron, fetching at most 30 detail pages per run with a delay between requests. A Vault token protects the edge function; the browser never receives it. Only adverts with a recognisable Scottish location, verified dates, source URL, and a complete, delimited description are published. The source may deny access, rate-limit the importer, change its format, omit records, or include third-party content; no guarantee of coverage or a specific number is made. Provider descriptions older than seven days and records not re-observed within five days are hidden. The super-admin can see the last run status on the jobs page. myjobscotland describes data-feed provision in line with Open Government Licence principles; follow its attribution and third-party terms.

## Hero photograph

`public/career-support.jpg` is a real photograph by Vitaly Gariev, [Woman working on laptop in modern office setting](https://unsplash.com/photos/woman-working-on-laptop-in-modern-office-setting-3vBESHYwRkE), published under the [Unsplash License](https://unsplash.com/license). The photograph is illustrative and is not presented as a photo of ScotSponsor staff or of Scotland.


## Job details and full descriptions

Each job card opens an on-site detail view. Signed-in super-admins can edit the full description from each available job; the editor is hidden from other users and saving is authorised on the server. Saved descriptions are public. Search snippets stay private until a complete detail is imported or entered. The application never displays an excerpt as a complete detail.

Provider descriptions are shown only while their source observation is current and the original listing fingerprint matches. Separately published attachments are not displayed in the job detail view. The platform does not submit applications to employers.

### Subscriber sponsorship checker

The account dashboard contains a checker for active Monthly Alert Pass or Job Hunt Pass holders and super-admins. The database RPC checks the entitlement on every search; it searches the active Scottish directory and returns at most 15 matches, without changing the Job Hunt-only directory access policy. Match evidence comes from the exact-name-and-town Home Office register snapshot, not the sponsor's individual hiring policy. Snapshots older than three days, missing snapshots and directory-version mismatches are marked unavailable. A match is not a job-specific sponsorship confirmation and an absent match does not prove that a company cannot sponsor. The requested disclaimer is displayed verbatim; the checker explicitly discloses that employer-level UKVI 2023–2025 sponsorship history is not currently connected and does not calculate likelihood from it. Membership grants remain manual; payment processing is not connected.
