export type Guide = {
  slug: string; category: 'Job search' | 'CV & applications' | 'Interviews' | 'Working in Scotland' | 'Sponsorship';
  title: string; description: string; reading: string; accent: string;
  intro: string; sections: { heading: string; body: string; bullets?: string[] }[];
  takeaway: string; sources: { label: string; url: string }[];
};

// Evergreen editorial guides, not live news or immigration advice.
export const guides: Guide[] = [
  {
    slug: 'a-smarter-scottish-job-search', category: 'Job search', title: 'A smarter way to start your Scottish job search',
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
    slug: 'sponsorship-questions-to-ask', category: 'Sponsorship', title: 'Sponsorship: the questions worth asking early',
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
    slug: 'cv-that-tells-your-story', category: 'CV & applications', title: 'Build a CV that tells your story clearly',
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
    slug: 'tailor-your-application', category: 'CV & applications', title: 'Tailor an application without starting over',
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
    slug: 'answer-interview-questions-with-star', category: 'Interviews', title: 'Tell a stronger interview story with STAR',
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
    slug: 'interview-day-checklist', category: 'Interviews', title: 'Your calm, practical interview-day checklist',
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
    slug: 'before-you-accept-a-job-offer', category: 'Working in Scotland', title: 'Before you say yes: reviewing a job offer',
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
    slug: 'follow-up-with-confidence', category: 'Job search', title: 'How to follow up without overthinking it',
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
