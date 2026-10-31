/** Planned offerings. Keep descriptions consistent across the public site and app. */
export const plans = {
  monthly: {
    name: 'Monthly Alert Pass',
    price: '£9.99',
    period: '/ month',
    description: 'A flexible way to keep your job search moving.',
    features: [
      'Email alerts for new jobs matching your role and location',
      'Job excerpts and available vacancy information',
      'Sponsor information and job wording where available',
      'Use the free saved jobs and application tracker',
    ],
    terms: 'Renews monthly. Cancel before your next renewal.',
  },
  jobHunt: {
    name: 'Job Hunt Pass',
    price: '£24.99',
    period: '/ one-off',
    description: 'One payment, with more time to focus on your search.',
    features: [
      'Everything in the Monthly Alert Pass for 90 days',
      'Email alerts matched to your role and location',
      'Professional CV builder with print-to-PDF and text download',
      'ATS-style CV keyword review against a job description',
      'AI cover letter generator (AI connection required)',
      'Graduate Visa Switch Planner with a personalised timeline',
      'Search and download the Scottish sponsor directory by industry or location',
      'Job-search checklist and employer outreach templates',
      'Request personalised application support from ScotSponsor',
    ],
    terms: '90 days of access. No automatic renewal.',
  },
} as const;
