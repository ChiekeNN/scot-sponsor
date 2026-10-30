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

- Search example jobs by title, company, location, category or tag.
- Filter by location, category and the sponsorship language in a listing; sort by newest or minimum salary.
- Open job details and save/remove jobs. Saved IDs are stored in the browser's local storage on that device; clearing browser data removes them.
- Read a practical guide linking to official UK government sources.
- View the proposed products and prices, and preview the alerts interface.
- Responsive layout for mobile and desktop.

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
