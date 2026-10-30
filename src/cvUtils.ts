export type Experience = { id: string; role: string; company: string; dates: string; details: string };
export type Education = { id: string; qualification: string; institution: string; dates: string; details: string };
export type CvData = { name: string; headline: string; email: string; phone: string; location: string; links: string; summary: string; skills: string; experience: Experience[]; education: Education[]; additional: string };
export const blankCv = (): CvData => ({ name: '', headline: '', email: '', phone: '', location: '', links: '', summary: '', skills: '', experience: [], education: [], additional: '' });

export function cvToText(cv: CvData): string {
  const lines: string[] = [];
  if (cv.name.trim()) lines.push(cv.name.trim());
  if (cv.headline.trim()) lines.push(cv.headline.trim());
  const contact = [cv.location, cv.email, cv.phone, cv.links].map(x => x.trim()).filter(Boolean).join(' | ');
  if (contact) lines.push(contact);
  const section = (title: string, content: string) => { if (content.trim()) lines.push('', title.toUpperCase(), content.trim()); };
  section('Professional summary', cv.summary);
  section('Skills', cv.skills);
  const experience = cv.experience.map(x => [ [x.role, x.company].filter(Boolean).join(' — '), x.dates, x.details ].filter(s => s.trim()).join('\n')).filter(Boolean).join('\n\n');
  const education = cv.education.map(x => [ [x.qualification, x.institution].filter(Boolean).join(' — '), x.dates, x.details ].filter(s => s.trim()).join('\n')).filter(Boolean).join('\n\n');
  section('Experience', experience); section('Education', education); section('Additional information', cv.additional);
  return lines.join('\n');
}

// Simple, deterministic word matching; not an employer ATS or semantic ranking system.
const STOP = new Set('a an and are as at be been being but by can could do does for from had has have if in into is it its may more most must of on or our should that the their them there these they this those through to was we were what when where which who will with within you your about all also any based candidate candidates company experience role work working job jobs team teams using use looking ability required requirements skills skill strong including include essential desirable responsible responsibilities opportunity opportunities excellent provide develop development across support knowledge good successful scotland uk'.split(' '));
function tokens(value: string): string[] {
  return (value.toLowerCase().match(/\.net|[a-z0-9]+(?:[.\/-][a-z0-9]+)*[+#]*/g) || [])
    .filter(word => !STOP.has(word) && !/^\d+$/.test(word) && (word.length > 1 || word === 'r' || word === 'c'));
}
export function analyseKeywords(cv: string, description: string) {
  const counts = new Map<string, number>();
  for (const word of tokens(description)) counts.set(word, (counts.get(word) || 0) + 1);
  const terms = [...counts.keys()].sort((a, b) => (counts.get(b)! - counts.get(a)!) || a.localeCompare(b)).slice(0, 20);
  const cvTokens = new Set(tokens(cv));
  const matched = terms.filter(word => cvTokens.has(word));
  const missing = terms.filter(word => !cvTokens.has(word));
  return { terms, matched, missing, coverage: terms.length ? Math.round(matched.length / terms.length * 100) : null };
}
