// Scotland-only Reed search candidates. The separate detail worker imports full descriptions.
const DAY=86400000;
const salary=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1000000000?v:null;
const clean=(v,n=6000)=>typeof v==='string'?v.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,n):'';
const towns=new Set(['aberdeen','dundee','edinburgh','glasgow','inverness','stirling','perth','dunfermline','paisley','kirkcaldy','livingston','ayr','falkirk','hamilton','east kilbride','cumbernauld','greenock','kilmarnock','motherwell','dumfries','irvine','coatbridge','airdrie','paisley','galashiels']);
// Exact Scottish council/region names broaden coverage without guessing from a vague UK location.
const scottishRegions=new Set(['aberdeen city','aberdeenshire','angus','argyll and bute','clackmannanshire','dumfries and galloway','dundee city','east ayrshire','east dunbartonshire','east lothian','east renfrewshire','city of edinburgh','edinburgh city','falkirk','fife','glasgow city','highland','highlands','inverclyde','midlothian','moray','na h-eileanan siar','western isles','north ayrshire','north lanarkshire','orkney','orkney islands','perth and kinross','renfrewshire','scottish borders','shetland','shetland islands','south ayrshire','south lanarkshire','stirling','west dunbartonshire','west lothian']);
const otherRegions=new Set(['england','wales','northern ireland','northumberland','cumbria','tyne and wear','durham','north yorkshire','lancashire','cheshire','merseyside','greater manchester','london','west yorkshire','south yorkshire','lincolnshire','nottinghamshire','derbyshire','staffordshire','norfolk','suffolk','essex','kent','surrey','hampshire','devon','cornwall','antrim','county antrim','armagh','county armagh','county down','county tyrone','county londonderry','county fermanagh','australia','united states']);
function scottish(location,area=[]){
 const parts=[...area,location].filter(v=>typeof v==='string').flatMap(v=>v.toLowerCase().split(',').map(x=>x.trim().replace(/\s*&\s*/g,' and ').replace(/\s+/g,' ')));
 // Scotland Gate is in Northumberland; contradictory non-Scottish regions always win.
 return !parts.some(p=>otherRegions.has(p)) && parts.some(p=>p==='scotland'||towns.has(p)||scottishRegions.has(p));
}
function date(v){
 if(typeof v!=='string')return null;
 const uk=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v.trim());
 const raw=uk?`${uk[3]}-${uk[2]}-${uk[1]}T00:00:00Z`:v;
 const time=Date.parse(raw);if(!Number.isFinite(time))return null;
 if(uk && new Date(time).toISOString().slice(0,10)!==`${uk[3]}-${uk[2]}-${uk[1]}`)return null;
 return new Date(time).toISOString();
}
function link(url){try{const u=new URL(url);return u.protocol==='https:'&&/(^|\.)reed\.co\.uk$/i.test(u.hostname)&&!u.username&&!u.password?u.href:null}catch{return null}}
export function normaliseJob(source,raw,now=Date.now()){
 if(source!=='reed')return null;
 const id=String(raw?.jobId??'');
 const title=clean(raw?.jobTitle,200);
 const location=clean(raw?.locationName,200);
 const posted=date(raw?.date);
 const url=link(raw?.jobUrl);
 if(!/^[a-z0-9_-]{1,100}$/i.test(id)||!title||!location||!scottish(location)||!posted||!url||Date.parse(posted)<now-14*DAY||Date.parse(posted)>now)return null;
 return {source,external_id:id,title,location,location_search:`${location}, Scotland`,employer:clean(raw?.employerName,200),description:clean(raw?.jobDescription,6000),posted_at:posted,source_url:url,salary_min:salary(raw?.minimumSalary),salary_max:salary(raw?.maximumSalary),salary_is_predicted:null,contract_type:null,contract_time:null};
}
export async function collectSource(source,{request=fetch,env=process.env,now=Date.now(),pageLimit=24}={}){
 if(source!=='reed')throw Error('UNKNOWN_SOURCE');
 if(!env.REED_API_KEY)throw Error('NOT_CONFIGURED');
 const results=new Map();let truncated=false;
 for(let page=0;page<pageLimit;page++){
  const url=new URL('https://www.reed.co.uk/api/1.0/search');
  for(const [k,v] of Object.entries({locationName:'Scotland',resultsToTake:'100',resultsToSkip:String(page*100)}))url.searchParams.set(k,v);
  const headers={Accept:'application/json',Authorization:`Basic ${Buffer.from(`${env.REED_API_KEY}:`).toString('base64')}`};
  const response=await request(url.href,{headers,signal:AbortSignal.timeout(15000),redirect:'error'});
  if(!response.ok)throw Error('UPSTREAM_ERROR');
  const data=await response.json();if(!Array.isArray(data?.results))throw Error('INVALID_RESPONSE');
  const size=100;
  for(const raw of data.results){const job=normaliseJob(source,raw,now);if(job)results.set(job.external_id,job)}
  if(data.results.length<size)break;
  if(page===pageLimit-1)truncated=true;
 }
 return {jobs:[...results.values()],truncated};
}
