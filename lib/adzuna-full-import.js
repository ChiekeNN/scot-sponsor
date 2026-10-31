import {descriptionText} from './reed-details.js';
const DAY=86400000;
const normalise=v=>typeof v==='string'?v.trim().replace(/\s+/g,' ').toLocaleLowerCase('en-GB'):'';
const validId=id=>typeof id==='string'&&/^\d{1,20}$/.test(id);
export function validateFullRecords(input,now=Date.now()){
 if(!Array.isArray(input)||input.length>10000)throw Error('INVALID_INPUT');
 const seen=new Set();return input.map(record=>{
  if(!record||!validId(record.external_id)||seen.has(record.external_id)||record.complete!==true||typeof record.title!=='string'||!record.title.trim()||typeof record.employer!=='string'||!record.employer.trim()||typeof record.location!=='string'||!record.location.trim())throw Error('INVALID_RECORD');
  const observed=typeof record.observed_at==='string'?Date.parse(record.observed_at):NaN;
  if(!Number.isFinite(observed)||observed>now||observed<now-7*DAY)throw Error('INVALID_DATE');
  const raw=record.full_description;if(typeof raw!=='string'||raw.length>200000)throw Error('INVALID_DESCRIPTION');
  const description=/<\/?(?:p|br|li|ul|ol|div|section|h[1-6]|strong|em)\b/i.test(raw)?descriptionText(raw):raw.replace(/\r\n?/g,'\n').trim();
  if(!description||description.length<20||description.length>30000||/adzuna/i.test(description))throw Error('INVALID_DESCRIPTION');
  seen.add(record.external_id);return {...record,full_description:description,observed_at:new Date(observed).toISOString()};
 });
}
export function buildImportPayload(record,job){
 if(!job||job.source!=='adzuna'||job.external_id!==record.external_id||normalise(job.title)!==normalise(record.title)||normalise(job.employer)!==normalise(record.employer)||normalise(job.location)!==normalise(record.location)||record.full_description.trim()===job.description.trim())return null;
 return {p_job_id:job.public_id,p_external_id:record.external_id,p_title:record.title,p_employer:record.employer,p_location:record.location,p_excerpt:job.description,p_description:record.full_description,p_observed_at:record.observed_at};
}
export async function importFullRecords(records,client,{apply=false}={}){
 const summary={received:records.length,matched:0,saved:0,skipped:0,failed:0};
 for(let i=0;i<records.length;i+=100){
  const group=records.slice(i,i+100);const query=await client.from('partner_jobs').select('public_id,source,external_id,title,employer,location,description').eq('source','adzuna').in('external_id',group.map(r=>r.external_id));
  if(query.error||!Array.isArray(query.data))throw Error('LOOKUP_FAILED');
  const jobs=new Map(query.data.map(job=>[job.external_id,job]));
  for(const record of group){const payload=buildImportPayload(record,jobs.get(record.external_id));if(!payload){summary.skipped++;continue}summary.matched++;if(!apply)continue;
   const result=await client.rpc('import_adzuna_full_description',payload);
   if(result.error){summary.failed++;continue}if(result.data==='saved')summary.saved++;else if(['mismatch','unavailable','stale','invalid','manual_preserved'].includes(result.data))summary.skipped++;else summary.failed++;
  }
 }
 return summary;
}
