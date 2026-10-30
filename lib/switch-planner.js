const DAY=86400000;
function parseDate(value) {
 if (typeof value!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Enter valid dates.');
 const date=new Date(`${value}T00:00:00Z`);
 if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10)!==value || date.getUTCFullYear()<2000 || date.getUTCFullYear()>2100) throw new Error('Enter valid dates.');
 return date;
}
const dateString = d => d.toISOString().slice(0,10);
const earlier = (date, days) => dateString(new Date(date.getTime()-days*DAY));
export function buildSwitchPlan(expiry, target) {
 const end=parseDate(expiry);
 const submission=target ? parseDate(target) : new Date(end.getTime()-30*DAY);
 if (submission >= end) throw new Error('Choose a target submission date before your visa expiry date.');
 return { expiry:dateString(end), target:dateString(submission), defaultTarget:!target, milestones:[
  {date:earlier(submission,120),title:'Start your sponsored job search',description:'Research occupations and employers, update your CV and identify roles where the employer is willing to sponsor.'},
  {date:earlier(submission,90),title:'Apply and build connections',description:'Apply for suitable roles, network and ask employers directly about sponsorship for the specific vacancy.'},
  {date:earlier(submission,60),title:'Confirm offer and sponsorship',description:'Discuss the occupation code, salary, work location and Certificate of Sponsorship with your prospective employer.'},
  {date:earlier(submission,30),title:'Prepare your application',description:'Review current eligibility, documents, fees and identity checks with GOV.UK and your sponsor.'},
  {date:dateString(submission),title:'Your target application date',description:'Aim to submit a complete, valid application before your permission expires. This is your planning target, not a legal deadline.'},
  {date:dateString(end),title:'Graduate visa expiry',description:'Check your eVisa for your actual permission end date. If permission has expired or you cannot apply in time, seek regulated immigration advice urgently.'}
 ]};
}
