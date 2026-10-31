export type Guide = {
  slug: string; category: 'Job search' | 'CV & applications' | 'Interviews' | 'Working in Scotland' | 'Sponsorship';
  title: string; description: string; reading: string; accent: string; image: string; reviewed?: string;
  intro: string; sections: { heading: string; body: string; bullets?: string[] }[];
  takeaway: string; sources: { label: string; url: string }[];
};

// Evergreen editorial guides, not live news or immigration advice.
export const guides: Guide[] = [
  {
    slug: 'sponsorship-certificates-and-skills-charge', image: '/images/journal/sponsor-records.jpg', category: 'Sponsorship', title: 'Certificates of Sponsorship and the Immigration Skills Charge',
    description: 'Understand the questions to ask about certificates, employer costs and possible exemptions.', reading: '5 min read', accent: 'sage', reviewed: '31 October 2026',
    intro: 'An organisation on the sponsor register may not be able or willing to sponsor a particular vacancy. It is sensible to check the job, the prospective worker’s circumstances and the current Home Office guidance separately.',
    sections: [
      { heading: 'Defined and Undefined certificates', body: 'A Defined Certificate of Sponsorship is generally used for a Skilled Worker applying for entry clearance from abroad; a sponsor applies for each Defined certificate. Undefined certificates cover in-country Skilled Worker applications and other routes. Allocations and approvals are held in the sponsor management system: the public register does not reveal an employer’s available allocation or guarantee a certificate.' },
      { heading: 'Immigration Skills Charge', body: 'For applicable routes the charge is the sponsor’s responsibility. Some cases are exempt, depending on the route, permission held when the CoS is assigned, occupation and other facts. Current valid study permission can qualify in circumstances described by the Home Office; Graduate permission alone does not. Neither employer type nor graduation alone establishes an exemption. Check the latest guidance with your sponsor or a regulated adviser.' },
      { heading: 'Costs and checks', body: 'The Home Office says a sponsor must pay the Immigration Skills Charge itself. Ask the employer to explain the actual offer and permitted costs in writing. Processing times and fees change; check GOV.UK rather than treating estimates or another applicant’s experience as a promise.' },
    ], takeaway: 'Ask the hiring team about the specific vacancy and consult current official guidance before making decisions.',
    sources: [{ label: 'GOV.UK: sponsor guidance, part 2', url: 'https://www.gov.uk/government/publications/workers-and-temporary-workers-guidance-for-sponsors-part-2-sponsor-a-worker/workers-and-temporary-workers-guidance-for-sponsors-part-2-sponsor-a-worker-general-information-accessible' }, { label: 'GOV.UK: Immigration Skills Charge', url: 'https://www.gov.uk/uk-visa-sponsorship-employers/immigration-skills-charge' }, { label: 'GOV.UK: sponsor register', url: 'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers' }],
  },
  {
    slug: 'care-work-rights-and-employer-checks', image: '/images/journal/healthcare-workers.jpg', category: 'Working in Scotland', title: 'Care work, employer checks and knowing where to get help',
    description: 'A practical starting point for inspecting Scottish care services, checking employers and finding support.', reading: '6 min read', accent: 'blue', reviewed: '31 October 2026',
    intro: 'A care-service inspection, a company record and a sponsor licence each tell you different things. None on its own guarantees a safe job or proves that a particular vacancy is sponsored.',
    sections: [
      { heading: 'Check the specific service and role', body: 'Search the Care Inspectorate for the specific registered service and read the full inspection report and dates, not just a single grade. Check the Scottish Social Services Council for whether the role requires registration and how to confirm it. The service, employer, sponsor and workplace can be different entities.' },
      { heading: 'Company and insolvency records', body: 'Use the exact company number to review Companies House records and search The Gazette for relevant official insolvency notices. A name match alone is not proof that a notice concerns your employer. These checks are not live monitoring, and the absence of a notice is not a guarantee of financial health.' },
      { heading: 'NHS and relocation', body: 'NHS Scotland has 14 territorial boards as well as national boards. Check the official NHS Scotland recruitment site for vacancies and ask the individual hiring team whether a specific role offers sponsorship. For Highlands and Islands opportunities, investigate travel, housing and relocation help directly with the employer and local services; support is not automatic.' },
      { heading: 'If something feels unsafe', body: 'Keep copies of relevant documents where safe, seek independent regulated advice and contact a union or Acas about workplace rights. If there is immediate danger call 999. The mygov.scot trafficking support page explains confidential help for exploitation and trafficking.' },
    ], takeaway: 'Verify the exact organisation and service, and seek help early if you are worried.',
    sources: [{ label: 'Care Inspectorate', url: 'https://www.careinspectorate.com/' }, { label: 'Scottish Social Services Council', url: 'https://www.sssc.uk.com/' }, { label: 'Companies House: find company information', url: 'https://find-and-update.company-information.service.gov.uk/' }, { label: 'The Gazette: insolvency notices', url: 'https://www.thegazette.co.uk/insolvency' }, { label: 'NHS Scotland recruitment', url: 'https://apply.jobs.scot.nhs.uk/' }, { label: 'mygov.scot: trafficking support', url: 'https://www.mygov.scot/human-trafficking-support' }, { label: 'Acas: advice', url: 'https://www.acas.org.uk/advice' }],
  },
  {
    slug: 'scotland-founder-and-legal-support', image: '/images/journal/founder-planning.jpg', category: 'Sponsorship', title: 'Building a future in Scotland: founder and legal resources',
    description: 'Explore regulated advice, Scottish business support and the Innovator Founder route.', reading: '5 min read', accent: 'lavender', reviewed: '31 October 2026',
    intro: 'A graduate considering a business or a change of immigration route needs advice specific to their permission and plans. These resources are a starting point, not a promise of eligibility or a vetted directory.',
    sections: [
      { heading: 'Find regulated advice', body: 'GOV.UK links to the Immigration Advice Authority adviser finder and the Law Society of Scotland. The Law Society’s search can filter by area of law, location and legal aid. Contact services directly to confirm regulation, fees, availability and whether they can help your circumstances.' },
      { heading: 'Explore the Innovator Founder route', body: 'The route requires an endorsing body and, for a new business, a business idea that is innovative, viable and scalable, among other conditions. Read the current Immigration Rules and check whether you can switch from your present route. Older Graduate Entrepreneur and Start-up routes have different rules; do not assume they remain open to new applicants.' },
      { heading: 'Business support in Scotland', body: 'Business Gateway provides practical start-up resources and local advice. Universities may also have enterprise teams and incubators: ask your institution about eligibility and what support it currently offers. Business support and immigration endorsement are separate.' },
    ], takeaway: 'Check the current rules and discuss your plans with a regulated adviser before relying on a proposed route.',
    sources: [{ label: 'GOV.UK: find an immigration adviser', url: 'https://www.gov.uk/find-an-immigration-adviser' }, { label: 'Law Society of Scotland: find legal help', url: 'https://www.lawscot.org.uk/for-the-public/frequently-asked-questions/' }, { label: 'GOV.UK: Innovator Founder rules', url: 'https://www.gov.uk/guidance/immigration-rules/immigration-rules-appendix-innovator-founder' }, { label: 'Business Gateway Scotland', url: 'https://www.bgateway.com/' }],
  },
  {
    slug: 'visa-when-a-relationship-ends', image: '/images/journal/highlands-loch.jpg', category: 'Sponsorship', title: 'If your relationship ends: understanding your visa options',
    description: 'A sensitive, practical guide to notifying the Home Office and finding support in Scotland.', reading: '5 min read', accent: 'lavender', reviewed: '30 October 2026',
    intro: 'A separation can be difficult, and immigration questions may add to the uncertainty. If your permission is based on your relationship, check the official guidance promptly and get individual advice. You do not need to handle this alone.',
    sections: [
      { heading: 'Who may need to tell the Home Office?', body: 'GOV.UK says you must usually tell the Home Office if you separate or divorce and your visa is based on the relationship. This includes some partner and dependant visas and may include an EU Settlement Scheme family permit or dependant pre-settled status. The same rules can apply if your former partner’s permission depends on you. Different rules apply to British National (Overseas) visas: GOV.UK says holders do not need to report separation or divorce.' },
      { heading: 'Tell the Home Office safely', body: 'GOV.UK provides an online service or a postal route. For a postal notification, the guidance describes a public statement if you do not want details from your letter shared with your former partner, or a consent form if you do. Check the current instructions and consider getting independent help if sharing information could put you at risk. If you later reconcile, GOV.UK says to update the Home Office.' },
      { heading: 'Explore your options to stay', body: 'If your permission is based on a relationship that has ended and you want to stay, GOV.UK says to apply as soon as possible after the breakdown and not wait for your current visa to expire. Depending on your circumstances, you may be able to apply on a work, parent or private-life route, or for settlement in certain cases, including where a relationship ended because of domestic abuse. None of these routes is automatic; check eligibility and seek regulated immigration advice.' },
      { heading: 'Safety and support in Scotland', body: 'If you or your children are in immediate danger, call 999. Scotland’s Domestic Abuse and Forced Marriage Helpline offers confidential support to anyone affected: 0800 027 1234, 24 hours a day. You can also use the mygov.scot support link below. Consider whether it is safe to use this device or receive communications before seeking help.' },
    ], takeaway: 'If it is safe to do so, read the official guidance and contact a regulated immigration adviser about your own circumstances.',
    sources: [{ label: 'GOV.UK: tell the Home Office', url: 'https://www.gov.uk/visas-when-you-separate-or-divorce' }, { label: 'GOV.UK: apply to stay in the UK', url: 'https://www.gov.uk/visas-when-you-separate-or-divorce/apply-stay-uk' }, { label: 'mygov.scot: support in Scotland', url: 'https://www.mygov.scot/relationship-problem' }, { label: 'GOV.UK: find an immigration adviser', url: 'https://www.gov.uk/find-an-immigration-adviser' }],
  },
  {
    slug: 'if-your-visa-sponsor-loses-licence', image: '/images/journal/reviewing-documents.jpg', category: 'Sponsorship', title: 'If your visa sponsor loses its licence: what to check',
    description: 'Understand the difference between a licence suspension and loss, and where to find official help.', reading: '5 min read', accent: 'blue', reviewed: '30 October 2026',
    intro: 'News about an employer’s sponsorship licence can be unsettling. The right next step depends on whether the licence is suspended or lost, whether you are in the UK and your own immigration circumstances.',
    sections: [
      { heading: 'If the licence is lost while you are in the UK', body: 'GOV.UK says your Certificate of Sponsorship will be cancelled and your visa limited to 60 days, or the time remaining if less. You must leave your job and leave the UK unless you make a new visa application within the applicable time. If you were involved in the reasons for the licence loss, GOV.UK says your visa will be withdrawn and you will have to leave immediately. Check any UKVI notice and get regulated advice promptly; do not assume when a deadline starts or that a new application will succeed.' },
      { heading: 'A suspension is different', body: 'According to GOV.UK, if a sponsor’s licence is suspended, someone already working can keep working, and someone who has travelled to the UK but not started work can start. An application to extend will not be processed until the suspension ends. This is not the same as a lost licence; read the official guidance and contact UKVI or a qualified adviser if uncertain.' },
      { heading: 'If you are outside the UK', body: 'GOV.UK says that if the licence is lost, an application will be refused; a person with a visa who has not yet travelled will have their visa cancelled and will not be allowed to enter. If the licence is suspended, an application is put on hold and UKVI will contact people who have a visa but have not travelled. Check the current official register and guidance before travel.' },
      { heading: 'Takeovers and non-renewal', body: 'GOV.UK describes a 60-day limitation, or less if less permission remains, if a sponsor does not renew its licence or a new employer does not apply for a sponsor licence within 28 days after a takeover. The outcome depends on your circumstances. A missing match in a third-party directory is not proof a licence has been revoked; check with UKVI and seek advice.' },
    ], takeaway: 'Read any UKVI correspondence carefully, check the official guidance and speak to a regulated immigration adviser promptly.',
    sources: [{ label: 'GOV.UK: if your visa sponsor loses their licence', url: 'https://www.gov.uk/employee-lose-sponsor-licence' }, { label: 'GOV.UK: register of licensed sponsors', url: 'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers' }, { label: 'GOV.UK: find an immigration adviser', url: 'https://www.gov.uk/find-an-immigration-adviser' }],
  },
  {
    slug: 'a-smarter-scottish-job-search', image: '/images/journal/edinburgh-street.jpg', category: 'Job search', title: 'A smarter way to start your Scottish job search',
    description: 'Turn a broad search into a manageable plan, one meaningful step at a time.', reading: '4 min read', accent: 'blue',
    intro: 'A good job search is less about applying everywhere and more about knowing what you are looking for, keeping a record, and improving as you go.',
    sections: [
      { heading: 'Start with a focused shortlist', body: 'Write down a few job titles, the locations you can realistically work in and the skills you want to use. Try alternative titles too: similar work can be advertised under different names.', bullets: ['Search employer career pages and trusted job boards.', 'Check whether the role is remote, hybrid or on-site before applying.', 'Save the job description and closing date so you can refer back to them.'] },
      { heading: 'Build a sustainable routine', body: 'Set aside time for finding roles, tailoring applications and following up. A small number of well-matched applications may be more useful than a rush of generic ones. Track the employer, role, date and next action.' },
      { heading: 'Review and adjust', body: 'After a few applications, notice where you are getting responses. Ask for feedback where possible, revisit the requirements and adapt your CV honestly. Use university careers services or local careers support if available to you.' },
    ], takeaway: 'Pick three suitable roles this week and note one specific reason each is a good fit.',
    sources: [{ label: 'National Careers Service: careers advice', url: 'https://nationalcareers.service.gov.uk/careers-advice' }],
  },
  {
    slug: 'sponsorship-questions-to-ask', image: '/images/journal/professional-conversation.jpg', category: 'Sponsorship', title: 'Sponsorship: the questions worth asking early',
    description: 'A sponsor licence is a starting point—not a promise that every vacancy is sponsored.', reading: '4 min read', accent: 'sage',
    intro: 'If you need sponsorship, asking clear questions early can help you decide where to focus. A company appearing on the sponsor register does not mean it will sponsor every position.',
    sections: [
      { heading: 'Check the employer and the role separately', body: 'Use the official register as a starting point and check that the organisation name matches. Then read the vacancy carefully: an employer’s licence does not confirm sponsorship or a certificate for the specific role.' },
      { heading: 'Ask a clear, respectful question', body: 'You can contact the hiring team before investing a lot of time in an application. Keep your question about the specific role and ask about the employer’s process.', bullets: ['“Does this position offer Skilled Worker sponsorship for a suitable candidate?”', '“If so, what does your sponsorship process look like?”', '“Who can I speak to about the requirements for this vacancy?”'] },
      { heading: 'Verify your own circumstances', body: 'Visa requirements depend on the route, the job, salary, occupation and individual circumstances. Rules change, so use current GOV.UK guidance and consider advice from a qualified immigration adviser. This guide is not immigration advice.' },
    ], takeaway: 'Keep a note of the answer and the date, and confirm important details with the employer in writing.',
    sources: [{ label: 'GOV.UK: register of licensed sponsors', url: 'https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers' }, { label: 'GOV.UK: Skilled Worker visa', url: 'https://www.gov.uk/skilled-worker-visa' }],
  },
  {
    slug: 'cv-that-tells-your-story', image: '/images/journal/planning-a-cv.jpg', category: 'CV & applications', title: 'Build a CV that tells your story clearly',
    description: 'Make it easy for a recruiter to see the experience and skills you bring.', reading: '5 min read', accent: 'lavender',
    intro: 'Your CV is a concise introduction, not a record of everything you have ever done. Focus on relevant evidence and keep the layout easy to read.',
    sections: [
      { heading: 'Make the essentials easy to find', body: 'Include your name, contact details, a short relevant summary, skills, experience and education. Use clear headings and consistent dates. You can include projects, volunteering or internships when they demonstrate relevant experience.' },
      { heading: 'Show the impact of your work', body: 'Describe what you did, how you did it and the result where you can support it. For example: “Created a shared tracker that helped the team monitor weekly enquiries.” Use accurate numbers only when you can explain them.' },
      { heading: 'Tailor, proofread and protect your privacy', body: 'Compare your CV with the job description and use relevant language naturally, without claiming skills you do not have. Check spelling and links. Avoid including sensitive identity information such as passport numbers or your date of birth unless genuinely needed later in a secure process.' },
    ], takeaway: 'Choose one achievement and rewrite it so that the action and result are both clear.',
    sources: [{ label: 'National Careers Service: how to write a CV', url: 'https://nationalcareers.service.gov.uk/careers-advice/cv-sections' }],
  },
  {
    slug: 'tailor-your-application', image: '/images/journal/tailoring-an-application.jpg', category: 'CV & applications', title: 'Tailor an application without starting over',
    description: 'A simple checklist for connecting your experience to the role in front of you.', reading: '3 min read', accent: 'sand',
    intro: 'A tailored application shows the employer why your experience matters to their particular role. It does not require inventing a new CV for every vacancy.',
    sections: [
      { heading: 'Find the important requirements', body: 'Read the role description and highlight the recurring responsibilities, essential skills and experience. Separate the things you can evidence from the things you would need to learn.' },
      { heading: 'Match your evidence', body: 'Bring your most relevant experience higher up the page. Use the employer’s terminology where it accurately describes your work, and give a short example of how you used each relevant skill.' },
      { heading: 'Check the final details', body: 'Follow the requested format, check the employer and role names, and review the application for errors. If you use a keyword checker, treat it as a prompt for review—not as proof of how an employer’s system will rank your CV.' },
    ], takeaway: 'Before sending, find two requirements and underline the evidence for each in your application.',
    sources: [{ label: 'National Careers Service: careers advice', url: 'https://nationalcareers.service.gov.uk/careers-advice' }],
  },
  {
    slug: 'answer-interview-questions-with-star', image: '/images/journal/interview-conversation.jpg', category: 'Interviews', title: 'Tell a stronger interview story with STAR',
    description: 'Give your examples structure while still sounding like yourself.', reading: '4 min read', accent: 'peach',
    intro: 'The STAR method can help you answer questions about a time you demonstrated a skill. It gives your listener enough context to understand your contribution.',
    sections: [
      { heading: 'Situation and task', body: 'Briefly explain the situation and what you were responsible for. Choose an example that relates to the question and give only enough background to make it understandable.' },
      { heading: 'Action and result', body: 'Spend most of your answer on the steps you personally took. Finish with the result and what you learned. Be specific about your contribution and honest about outcomes.', bullets: ['Situation: What was happening?', 'Task: What needed to be done?', 'Action: What did you do and why?', 'Result: What happened, and what did you learn?'] },
      { heading: 'Practise, but don’t memorise a script', body: 'Prepare a few flexible examples from work, study, projects or volunteering. Practise saying them aloud and adjust the detail to the question. It is fine to pause and ask for clarification.' },
    ], takeaway: 'Write four short STAR notes for one project, then explain it aloud in your own words.',
    sources: [{ label: 'National Careers Service: interview tips', url: 'https://nationalcareers.service.gov.uk/careers-advice/interview-advice' }],
  },
  {
    slug: 'interview-day-checklist', image: '/images/journal/interview-preparation.jpg', category: 'Interviews', title: 'Your calm, practical interview-day checklist',
    description: 'What to prepare before, during and after an in-person or video interview.', reading: '4 min read', accent: 'blue',
    intro: 'You do not need to predict every question. A little preparation gives you more room to listen, think and show what you can do.',
    sections: [
      { heading: 'Before the interview', body: 'Confirm the date, time, format, location and contact details. Read the role description, research the organisation and prepare a few examples of your work. For video interviews, test your connection, microphone and camera.' },
      { heading: 'During the conversation', body: 'Listen to the full question, take a moment to think and give a relevant example. Ask for clarification if needed. Prepare a couple of questions of your own about the team, the role or the next steps.' },
      { heading: 'Afterwards', body: 'Make a note of what went well and what you would change next time. If the decision takes longer than expected, a polite follow-up is reasonable. If you are unsuccessful, you can ask for feedback, although employers may not always provide it.' },
    ], takeaway: 'Put the interview details and a short list of examples somewhere you can find them easily.',
    sources: [{ label: 'National Careers Service: interview tips', url: 'https://nationalcareers.service.gov.uk/careers-advice/interview-advice' }, { label: 'National Careers Service: video interviews', url: 'https://nationalcareers.service.gov.uk/careers-advice/how-to-do-well-in-video-interviews' }],
  },
  {
    slug: 'before-you-accept-a-job-offer', image: '/images/journal/reviewing-an-offer.jpg', category: 'Working in Scotland', title: 'Before you say yes: reviewing a job offer',
    description: 'Look beyond the headline salary and understand the practical details of your offer.', reading: '4 min read', accent: 'sage',
    intro: 'Receiving an offer is exciting. Take time to understand the terms and ask questions before deciding whether the role works for you.',
    sections: [
      { heading: 'Look at the whole offer', body: 'Check the job title, salary, expected hours, location, start date and whether the role is permanent or fixed-term. Consider travel costs and working arrangements alongside the pay.' },
      { heading: 'Ask for the details in writing', body: 'Review the offer and employment terms carefully. Ask about holiday, probation, notice and any conditions attached to the offer. Keep copies of correspondence and clarify anything you do not understand.' },
      { heading: 'If you need sponsorship', body: 'Confirm whether the specific role offers sponsorship and ask about next steps, timings and responsibilities. Check current official guidance or seek qualified advice about your own circumstances before making important decisions.' },
    ], takeaway: 'Write down your outstanding questions and ask the employer for clarification before you decide.',
    sources: [{ label: 'Acas: written statements and employment terms', url: 'https://www.acas.org.uk/what-must-be-written-in-an-employment-contract/what-the-written-statement-must-include' }, { label: 'GOV.UK: Skilled Worker visa', url: 'https://www.gov.uk/skilled-worker-visa' }],
  },
  {
    slug: 'follow-up-with-confidence', image: '/images/journal/following-up.jpg', category: 'Job search', title: 'How to follow up without overthinking it',
    description: 'A polite message can help you stay organised and keep a conversation moving.', reading: '3 min read', accent: 'lavender',
    intro: 'Waiting to hear back can be difficult. A short, courteous follow-up can help you understand what happens next without putting pressure on the hiring team.',
    sections: [
      { heading: 'Check the timeline first', body: 'Look for a date in the job listing or interview correspondence. If the employer has shared a decision date, allow them time to get back to you before following up.' },
      { heading: 'Keep the message simple', body: 'Use the role title, remind the recipient when you applied or interviewed, and ask whether there is an update. Thank them for their time. Avoid sending repeated messages in quick succession.' },
      { heading: 'Make the next step easy', body: 'Keep a record of the date you contacted them and continue your other applications while you wait. If the answer is no, you can ask politely for feedback and use any useful response to improve.' },
    ], takeaway: 'Draft a two-sentence follow-up and save it for the right time rather than rewriting it under pressure.',
    sources: [{ label: 'Acas: rejected job applications', url: 'https://www.acas.org.uk/if-an-employer-says-you-cannot-apply-or-rejects-you-for-a-job' }],
  },
];
