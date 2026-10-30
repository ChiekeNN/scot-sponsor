# ScotSponsor

A Scotland-focused job discovery prototype, based on the ScotSponsor development brief. It is a React, TypeScript and Vite application that runs locally without accounts or external services.

## Run locally

Requires Node.js 18+ (Node 20 LTS recommended).

```bash
npm install
npm run dev
```

Open the URL printed by Vite. For a production build, run `npm run build`; `npm run preview` serves that build locally.

## What works

- Visitors first see a public homepage with an introduction, product information and planned pricing. They can explore the dashboard and tools in an explicitly labelled demo without an account.
- Sign-in and membership prompts describe planned functionality; no credentials or payment information are collected. Alert and membership actions surface the planned subscription options, but do **not** grant paid access.

- Search example jobs by title, company, location, category or tag.
- Filter by location, category and the sponsorship language in a listing; sort by newest or minimum salary.
- Open job details and save/remove jobs. Saved IDs are stored in the browser's local storage on that device; clearing browser data removes them.
- Read a practical guide linking to official UK government sources.
- View the proposed products and prices, and preview the alerts interface.
- A home dashboard with a daily job-search tip, links to tools and a shortlist summary.
- Scottish income tax and employee National Insurance estimator for the **2026–27 tax year**, with a monthly budget planner. It is illustrative and excludes pensions, student loans, other income and tax-code adjustments. It is not tax, financial or immigration advice; verify current rates with [GOV.UK](https://www.gov.uk/guidance/rates-and-thresholds-for-employers-2026-to-2027).
- A CV studio preview, intended for the Job Hunt Pass: create a structured CV, add multiple experience and education entries, download plain text or print/save as PDF, and compare CV text with a pasted job description. PDF, DOCX and TXT uploads are processed locally (5 MB maximum, 20-page PDF maximum); scanned/image-only PDFs require OCR and are not supported. The checker uses simple word overlap, not an employer ATS or a prediction of outcomes. It does not understand synonyms or document layout; review suggestions for accuracy. CV drafts are stored in browser local storage on this device, while uploaded CV text and job descriptions are kept in memory only. Do not add passport numbers, dates of birth or other sensitive details. Clearing browser data deletes saved drafts.
- An application tracker for roles entered by the user, including editable stages, notes and follow-up dates. Tracker data stays in browser local storage; no reminders or cloud syncing are provided. Avoid storing sensitive information.
- Optional PWA installation and cached app shell in production. Installation is never required, the suggestion can be dismissed, and the app does not request notification permission. Browsers control whether they support installation and the native prompt. The app remembers installation or dismissal in the same browser's storage, but cannot reliably detect installation across different browsers, profiles or separately isolated iOS web-app storage. Closing the app and opening the site in a browser returns users to the normal website; uninstall via the device's app controls.
- Responsive layout for mobile and desktop.

Run `npm test` for calculator and CV-checker checks. The service worker is registered only for production builds: test installation and offline behaviour using `npm run build` followed by `npm run preview`, on HTTPS or localhost. The shell and previously cached resources can load offline, but there is no live job data or offline sync. Browser storage can be cleared or unavailable, so it should not be treated as a backup.

## Important limitations

**This is a prototype, not a live job board.** All six jobs and employers in `src/App.tsx` are fictional. Posting times and salaries are illustrative, not live data. Sponsorship labels demonstrate how language in a job description might be shown; they are not UKVI verification, a certificate of sponsorship or a determination of visa eligibility. The app deliberately does not claim that a licensed sponsor will sponsor a specific role. Salary alone cannot establish Skilled Worker eligibility: occupation codes, going rates, individual circumstances and current rules matter.

There is no backend, authentication, live job feed, sponsor-register sync, SOC matching, automated notifications, checkout, paid access, or downloadable kit. The alert form is a UI preview only: the email is neither saved nor sent. Pricing is a roadmap, not an operational checkout. Do not advertise this prototype as a verified or production-ready service.

## Path to production

1. Obtain permission and API credentials for job sources; ingest and deduplicate jobs with source URLs, timestamps and expiry handling.
2. Import the current official register on a schedule. Store provenance and last-checked dates; reconcile employer names with reviewable confidence scores. A register match must not be presented as proof that a specific job sponsors.
3. Store jobs, sponsors and user preferences in a database; add authentication, access controls and a privacy policy. Use server-side secrets and row-level security where appropriate.
4. Classify explicit sponsorship language conservatively; make ambiguous results visible for review. Maintain current occupation and salary rules with qualified legal review, and link to official guidance rather than making individual eligibility decisions.
5. Add Stripe Checkout and verified webhooks for subscription entitlements, cancellations and one-off purchases. Do not trust client-side payment state.
6. Connect opt-in notifications via Telegram or another provider, with unsubscribe, delivery retries, rate limits and monitoring. Only promise delivery times that the system actually meets.
7. Add automated tests, accessibility checks, analytics with consent, error monitoring and deployment configuration before launch.

The app is independent and is not affiliated with the UK Home Office. It does not provide immigration advice.
