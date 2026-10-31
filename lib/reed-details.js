import {parse} from 'node-html-parser';

// Preserve readable paragraphs and bullets while rejecting oversized/incomplete responses.
export function descriptionText(html){
 if(typeof html!=='string'||html.length>200000)return null;
 const root=parse(html);root.querySelectorAll('script,style,iframe,object,svg,form').forEach(node=>node.remove());
 const block=new Set(['P','DIV','SECTION','ARTICLE','HEADER','FOOTER','H1','H2','H3','H4','H5','H6','UL','OL','LI','BR','TR']);
 function walk(node,depth=0){if(depth>80)throw Error('INVALID_DESCRIPTION');if(node.nodeType===3)return node.textContent||'';const tag=node.tagName?.toUpperCase()||'';const children=(node.childNodes||[]).map(n=>walk(n,depth+1)).join('');return block.has(tag)?`\n${tag==='LI'?'• ':''}${children}\n`:children}
 try{const text=walk(root).replace(/\r/g,'').split('\n').map(x=>x.replace(/[\t ]+/g,' ').trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim();return text.length>=20&&text.length<=30000?text:null}catch{return null}
}
function expiry(v){if(typeof v!=='string'||!v.trim())return null;const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());if(!m)return null;const d=new Date(`${m[3]}-${m[2]}-${m[1]}T23:59:59.999Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===`${m[3]}-${m[2]}-${m[1]}`?d.toISOString():null}
const amount=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1000000000?v:null;
const oneOf=(v,a)=>typeof v==='string'&&a.includes(v.trim().toLowerCase())?v.trim().toLowerCase():null;
function period(v){if(typeof v!=='string')return null;const key=v.toLowerCase().replace(/[^a-z]/g,'');return ({perhour:'hour',hour:'hour',perday:'day',day:'day',perweek:'week',week:'week',permonth:'month',month:'month',perannum:'year',peryear:'year',annual:'year',year:'year'})[key]||null}
export function reedDetailPayload(job,detail){
 if(!job||!/^\d+$/.test(job.external_id)||String(detail?.jobId??'')!==job.external_id)return null;
 const description=descriptionText(detail.jobDescription);if(!description||typeof detail.jobTitle!=='string'||!detail.jobTitle.trim()||typeof detail.locationName!=='string'||!detail.locationName.trim())return null;
 const validCurrency=detail.currency==null||detail.currency==='GBP';
 return {p_job_id:job.id,p_external_id:job.external_id,p_fingerprint:job.listing_fingerprint,p_title:descriptionTextShort(detail.jobTitle),p_employer:descriptionTextShort(detail.employerName||''),p_location:descriptionTextShort(detail.locationName),p_description:description,p_expires_at:expiry(detail.expirationDate),p_salary_min:validCurrency?amount(detail.minimumSalary):null,p_salary_max:validCurrency?amount(detail.maximumSalary):null,p_salary_period:validCurrency?period(detail.salaryType):null,p_contract_type:oneOf(detail.contractType,['permanent','contract','temporary']),p_contract_time:detail.fullTime===true&&detail.partTime!==true?'full_time':detail.partTime===true&&detail.fullTime!==true?'part_time':null};
}
function descriptionTextShort(v){return typeof v==='string'?parse(v.slice(0,1000)).textContent.replace(/\s+/g,' ').trim():''}
export async function fetchReedDetail(job,{request=fetch,apiKey,timeoutMs=5000}={}){
 if(!apiKey||!/^\d+$/.test(job.external_id))throw Error('INVALID_CONFIGURATION');
 const response=await request(`https://www.reed.co.uk/api/1.0/jobs/${job.external_id}`,{headers:{Accept:'application/json',Authorization:`Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`},signal:AbortSignal.timeout(timeoutMs),redirect:'error'});
 if(response.status===429){const e=Error('RATE_LIMITED');const raw=response.headers?.get?.('retry-after')||'';const n=/^\d+$/.test(raw)?Number(raw):Math.ceil((Date.parse(raw)-Date.now())/1000);e.retrySeconds=Number.isFinite(n)&&n>0?Math.min(2147483647,Math.max(1800,n)):1800;throw e}if(!response.ok)throw Error('UPSTREAM_ERROR');
 const data=await response.json();const payload=reedDetailPayload(job,data);if(!payload)throw Error('INVALID_RESPONSE');return payload;
}
