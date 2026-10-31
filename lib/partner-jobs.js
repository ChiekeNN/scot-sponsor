// Conservative source adapters: omit records without a verifiable Scottish location,
// posting date, or HTTPS source link. Job descriptions may be source excerpts.
const DAY=86400000;
const salary=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1000000000?v:null;
const contract=(v,allowed)=>typeof v==='string'&&allowed.includes(v.toLowerCase())?v.toLowerCase():null;
const clean=(v,n=6000)=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,n):'';
const towns=new Set(['aberdeen','dundee','edinburgh','glasgow','inverness','stirling','perth','dunfermline','paisley','kirkcaldy','livingston','ayr','falkirk','hamilton','east kilbride','cumbernauld','greenock','kilmarnock','motherwell','dumfries','irvine','coatbridge','airdrie','paisley','galashiels']);
function scottish(location,area=[]){
 const parts=[...area,location].filter(v=>typeof v==='string').flatMap(v=>v.toLowerCase().split(',').map(x=>x.trim()));
 // 'Scotland Gate' is in England, not Scotland; require an exact part.
 return !parts.includes('england') && !parts.includes('northumberland') && parts.some(p=>p==='scotland'||towns.has(p));
}
function date(v){
 if(typeof v!=='string')return null;
 const uk=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
 const raw=uk?`${uk[3]}-${uk[2]}-${uk[1]}T00:00:00Z`:v;
 const time=Date.parse(raw);if(!Number.isFinite(time))return null;
 if(uk && new Date(time).toISOString().slice(0,10)!==`${uk[3]}-${uk[2]}-${uk[1]}`)return null;
 return new Date(time).toISOString();
}
function link(url,source){try{const u=new URL(url);const valid=source==='adzuna'?/(^|\.)adzuna\.co\.uk$/i.test(u.hostname):/(^|\.)reed\.co\.uk$/i.test(u.hostname);if(!valid)return null;if(source==='adzuna'&&u.protocol==='http:')u.protocol='https:';return u.protocol==='https:'?u.href:null}catch{return null}}
export function normaliseJob(source,raw,now=Date.now()){
 const id=String(source==='adzuna'?raw?.id??'':raw?.jobId??'');
 const title=clean(source==='adzuna'?raw?.title:raw?.jobTitle,200);
 const location=clean(source==='adzuna'?raw?.location?.display_name:raw?.locationName,200);
 const area=source==='adzuna'&&Array.isArray(raw?.location?.area)?raw.location.area:[];
 const posted=date(source==='adzuna'?raw?.created:raw?.date);
 const url=link(source==='adzuna'?raw?.redirect_url:raw?.jobUrl,source);
 if(!/^[a-z0-9_-]{1,100}$/i.test(id)||!title||!location||!scottish(location,area)||!posted||!url||Date.parse(posted)<now-14*DAY||Date.parse(posted)>now)return null;
 return {source,external_id:id,title,location,employer:clean(source==='adzuna'?raw?.company?.display_name:raw?.employerName,200),description:clean(source==='adzuna'?raw?.description:raw?.jobDescription,6000),posted_at:posted,source_url:url,salary_min:salary(source==='adzuna'?raw?.salary_min:raw?.minimumSalary),salary_max:salary(source==='adzuna'?raw?.salary_max:raw?.maximumSalary),salary_is_predicted:source==='adzuna'&&(raw?.salary_is_predicted===1||raw?.salary_is_predicted==='1')?true:null,contract_type:contract(source==='adzuna'?raw?.contract_type:null,['permanent','contract','temporary']),contract_time:contract(source==='adzuna'?raw?.contract_time:null,['full_time','part_time'])};
}
export async function collectSource(source,{request=fetch,env=process.env,now=Date.now(),pageLimit=24}={}){
 if(source==='adzuna'&&(!env.ADZUNA_APP_ID||!env.ADZUNA_APP_KEY))throw Error('NOT_CONFIGURED');
 if(source==='reed'&&!env.REED_API_KEY)throw Error('NOT_CONFIGURED');
 const results=new Map();let truncated=false;
 for(let page=0;page<pageLimit;page++){
  const url=source==='adzuna'?new URL(`https://api.adzuna.com/v1/api/jobs/gb/search/${page+1}`):new URL('https://www.reed.co.uk/api/1.0/search');
  if(source==='adzuna')for(const [k,v] of Object.entries({app_id:env.ADZUNA_APP_ID,app_key:env.ADZUNA_APP_KEY,where:'Scotland',results_per_page:'50',max_days_old:'14',sort_by:'date','content-type':'application/json'}))url.searchParams.set(k,v);
  else for(const [k,v] of Object.entries({locationName:'Scotland',resultsToTake:'100',resultsToSkip:String(page*100)}))url.searchParams.set(k,v);
  const headers={Accept:'application/json'};if(source==='reed')headers.Authorization=`Basic ${Buffer.from(`${env.REED_API_KEY}:`).toString('base64')}`;
  const response=await request(url.href,{headers,signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok)throw Error('UPSTREAM_ERROR');
  const data=await response.json();if(!Array.isArray(data?.results))throw Error('INVALID_RESPONSE');
  const size=source==='adzuna'?50:100;
  for(const raw of data.results){const job=normaliseJob(source,raw,now);if(job)results.set(job.external_id,job)}
  if(data.results.length<size)break;
  if(page===pageLimit-1)truncated=true;
 }
 return {jobs:[...results.values()],truncated};
}
