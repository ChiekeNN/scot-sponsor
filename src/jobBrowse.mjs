// These are keyword searches over the loaded feed, not provider classifications.
const item=(id,label,terms,includeExcerpt=false,titleTerms=[])=>({id,label,terms,includeExcerpt,titleTerms});
export const browseGroups={
 industry:[
  item('accounting-finance','Accounting & Finance Jobs',['accounting','accountant','accountants','accountancy','finance','financial','bookkeeper','bookkeeping','payroll','audit','auditor']),
  item('admin','Admin Jobs',['admin','administrator','administration','administrative','receptionist','clerical','office assistant']),
  item('charity','Charity & Voluntary Jobs',['charity','charities','voluntary','volunteer','fundraiser','fundraising','nonprofit','non profit']),
  item('consultancy','Consultancy Jobs',['consultancy','consultant','consulting','advisor','adviser']),
  item('creative-design','Creative & Design Jobs',['creative','design','designer','designers','graphic','illustrator','creative director']),
  item('customer-services','Customer Services Jobs',['customer service','customer services','customer support','customer care','call centre','contact centre']),
  item('domestic-cleaning','Domestic help & Cleaning Jobs',['cleaner','cleaning','housekeeper','housekeeping','domestic','janitor']),
  item('energy-oil-gas','Energy, Oil & Gas Jobs',['energy','oil','gas','renewable','renewables','wind turbine','offshore']),
  item('engineering','Engineering Jobs',['engineering','engineer','engineers','mechanical technician','civil technician']),
  item('graduate','Graduate Jobs',['graduate','graduates']),
  item('hr-recruitment','HR & Recruitment Jobs',['hr','human resources','recruitment','recruiter','recruiting','talent acquisition','people advisor']),
  item('healthcare-nursing','Healthcare & Nursing Jobs',['healthcare','health care','nurse','nursing','medical','clinical','care worker','doctor','physician','pharmacist']),
  item('hospitality-catering','Hospitality & Catering Jobs',['hospitality','catering','chef','cook','kitchen','restaurant','hotel','barista','waiter','waitress']),
  item('it','IT Jobs',['it','information technology','software','developer','devops','cyber','technology','technical support','data engineer','web developer']),
  item('legal','Legal Jobs',['legal','law','lawyer','solicitor','paralegal','barrister','litigation']),
  item('logistics-warehouse','Logistics & Warehouse Jobs',['logistics','warehouse','warehousing','supply chain','distribution','forklift','delivery driver']),
  item('maintenance','Maintenance Jobs',['maintenance','maintainer','facilities technician']),
  item('manufacturing','Manufacturing Jobs',['manufacturing','production','factory','fabricator','machinist']),
  item('other-general','Other/General Jobs',['other','general','generalist']),
  item('marketing','PR, Advertising & Marketing Jobs',['pr','public relations','advertising','marketing','communications','social media','copywriter']),
  item('property','Property Jobs',['property','estate agent','real estate','lettings','surveyor','housing officer']),
  item('retail','Retail Jobs',['retail','shop','store','merchandiser','sales assistant']),
  item('sales','Sales Jobs',['sales','salesperson','business development','account executive']),
  item('scientific-qa','Scientific & QA Jobs',['scientific','scientist','science','laboratory','lab technician','qa','quality assurance','quality control']),
  item('social-work','Social work Jobs',['social work','social worker','social care']),
  item('teaching','Teaching Jobs',['teaching','teacher','lecturer','tutor','education','classroom assistant']),
  item('trade-construction','Trade & Construction Jobs',['trade','trades','construction','builder','building','electrician','plumber','joiner','carpenter','bricklayer','labourer']),
  item('travel','Travel Jobs',['travel','tourism','tour guide','travel agent','airline','aviation'])
 ],
 popular:[
  item('no-experience','No Experience Jobs',['no experience required','no experience necessary','no experience needed','no previous experience','experience not required','no experience is required','experience not necessary','experience not essential'],true,['no experience']),
  item('it-support','IT Support Jobs',['it support','technical support','service desk','help desk','helpdesk']),
  item('it-manager','IT Manager Jobs',['it manager','information technology manager','technology manager']),
  item('management','Management Jobs',['management','manager','managers','managing director']),
  item('operations','Operations Jobs',['operations','operation','operational']),
  item('communications','Communications Jobs',['communications','communication','public relations']),
  item('planning','Planning Jobs',['planning','planner']),
  item('operator','Operator Jobs',['operator','operators']),
  item('manager','Manager Jobs',['manager','managers']),
  item('medical','Medical Jobs',['medical','clinical','doctor','physician']),
  item('assistant','Assistant Jobs',['assistant','assistants']),
  item('it-training','IT Training Jobs',['it training','it trainer','technology trainer','software trainer','computer trainer']),
  item('training','Training Jobs',['training','trainer','trainers']),
  item('education','Education Jobs',['education','educational','teacher','teaching','lecturer','tutor']),
  item('disability','Disability Jobs',['disability','disabilities','disabled']),
  item('developer','Developer Jobs',['developer','developers','development engineer','software engineer','programmer']),
  item('insurance','Insurance Jobs',['insurance','underwriter','claims handler']),
  item('wellness','Wellness Jobs',['wellness','wellbeing','well being']),
  item('scheduler','Scheduler Jobs',['scheduler','scheduling','schedule coordinator']),
  item('law','Law Jobs',['law','legal','lawyer','solicitor','paralegal','barrister']),
  item('flexible','Flexible Jobs',['flexible','flexibility','flexi'],true),
  item('policy','Policy Jobs',['policy','policies']),
  item('physics','Physics Jobs',['physics','physicist']),
  item('industrial','Industrial Jobs',['industrial']),
  item('school','School Jobs',['school','schools']),
  item('reporter','Reporter Jobs',['reporter','journalist','correspondent']),
  item('designer','Designer Jobs',['designer','designers']),
  item('packaging','Packaging Jobs',['packaging','packer','packing']),
  item('recruitment','Recruitment Jobs',['recruitment','recruiter','recruiting']),
  item('it-recruiter','IT Recruiter Jobs',['it recruiter','recruiter it','it recruitment','recruitment it','technology recruiter','technical recruiter','technical recruitment'])
 ],
 location:['Aberdeen','Aberdeenshire','Angus','Argyll and Bute','Ayr','Clackmannanshire','Dundee','Dumfries and Galloway','Dunfermline','East Ayrshire','East Dunbartonshire','East Kilbride','East Lothian','East Renfrewshire','Edinburgh','Falkirk','Fife','Glasgow','Hamilton','Highland','Inverness','Inverclyde','Kilmarnock','Kirkcaldy','Livingston','Midlothian','Moray','Motherwell','North Ayrshire','North Lanarkshire','Orkney','Paisley','Perth','Perth and Kinross','Renfrewshire','Scottish Borders','Shetland','South Ayrshire','South Lanarkshire','Stirling','West Dunbartonshire','West Lothian','Western Isles','Scotland'].map(name=>item(name.toLowerCase().replace(/\s+/g,'-'),`${name} Jobs`,[name]))
};
export function getBrowseItem(selection){return selection&&Object.prototype.hasOwnProperty.call(browseGroups,selection.kind)?browseGroups[selection.kind].find(i=>i.id===selection.id)||null:null}
const normalise=value=>String(value||'').normalize('NFKC').toLocaleLowerCase('en-GB').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function matchesBrowse(job,selection){
 const choice=getBrowseItem(selection);if(!choice)return true;
 const title=` ${normalise(job.title)} `;
 if(choice.titleTerms.some(term=>title.includes(` ${normalise(term)} `)))return true;
 const value=normalise(selection.kind==='location'?job.location:choice.includeExcerpt?`${job.title} ${job.description||''}`:job.title);
 const padded=` ${value} `;
 return choice.terms.some(term=>padded.includes(` ${normalise(term)} `));
}
export function browseHref(selection){return `?browse=${encodeURIComponent(selection.kind)}&id=${encodeURIComponent(selection.id)}#scotland-jobs`}
export function browseFromSearch(search){const params=new URLSearchParams(search);const selection={kind:params.get('browse'),id:params.get('id')};return getBrowseItem(selection)?selection:null}
export function clearBrowseUrl(href){const url=new URL(href);url.searchParams.delete('browse');url.searchParams.delete('id');if(url.hash==='#scotland-jobs')url.hash='';return `${url.pathname}${url.search}${url.hash}`}
