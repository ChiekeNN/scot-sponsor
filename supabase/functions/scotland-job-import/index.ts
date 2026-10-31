import {createClient} from 'npm:@supabase/supabase-js@2';
import {parse} from 'npm:node-html-parser@7.0.1';

const host='https://myjobscotland.gov.uk';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false}});
const sleep=(ms:number)=>new Promise(r=>setTimeout(r,ms));
const tidy=(s:string)=>s.replace(/\s+/g,' ').trim();
function date(value:string,end=false){const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);if(!m)return null;const day=`${m[3]}-${m[2]}-${m[1]}`,d=new Date(`${day}T00:00:00Z`);if(!Number.isFinite(+d)||d.toISOString().slice(0,10)!==day)return null;return end?new Date(+d).toISOString():d.toISOString()}
function validUrl(raw:string){try{const u=new URL(raw,host);if(u.origin!==host||u.search||u.hash||!/^\/councils\/[a-z0-9-]+\/jobs\/[a-z0-9-]+-\d+$/.test(u.pathname))return null;return u.href}catch{return null}}
function links(html:string){const root=parse(html);return [...new Set(root.querySelectorAll('a[href]').map(a=>validUrl(a.getAttribute('href')||'')).filter((s):s is string=>!!s))]}
// A page with other organisations but no council results is not a parser failure.
// Only skip when the source clearly reports the expected result range and contains
// genuine job-detail links; a challenge page or changed markup must fail closed.
function searchPage(html:string,page:number){
 const root=parse(html), text=tidy(root.textContent||'');
 const range=/Showing\s*([\d,]+)\s*[-–]\s*([\d,]+)\s+of\s+([\d,]+)\s+available/i.exec(text);
 if(!range)return null;
 const first=Number(range[1].replace(/,/g,'')),last=Number(range[2].replace(/,/g,'')),total=Number(range[3].replace(/,/g,''));
 if(!Number.isSafeInteger(total)||!Number.isSafeInteger(first)||!Number.isSafeInteger(last)||first<1||last<first||last>total||first!==page*25+1||last-first>=25)return null;
 const anyJob=root.querySelectorAll('a[href]').some(a=>{try{const u=new URL(a.getAttribute('href')||'',host);return u.origin===host&&!u.search&&!u.hash&&/^\/(?:[a-z0-9-]+\/)+jobs\/[a-z0-9-]+-\d+$/.test(u.pathname)}catch{return false}});
 if(!anyJob)return null;
 return {total,list:links(html)};
}
const places=['scotland','aberdeen','aberdeenshire','angus','arbroath','montrose','forfar','brechin','argyll','bute','oban','dunoon','lochgilphead','campbeltown','helensburgh','islay','tarbert','clackmannanshire','alloa','sauchie','dumfries','galloway','annan','stranraer','castle douglas','kirkcudbright','dundee','east ayrshire','kilmarnock','cumnock','east dunbartonshire','kirkintilloch','bishopbriggs','milngavie','bearsden','east lothian','haddington','musselburgh','dunbar','prestonpans','tranent','east renfrewshire','barrhead','newton mearns','giffnock','edinburgh','falkirk','grangemouth','fife','dunfermline','kirkcaldy','glenrothes','st andrews','leven','cupar','glasgow','highland','inverness','fort william','aviemore','nairn','dingwall','tairg','ullapool','thurso','wick','alness','invergordon','skye','portree','inverclyde','greenock','gourock','port glasgow','midlothian','dalkeith','penicuik','bonnyrigg','moray','elgin','forres','buckie','lossiemouth','western isles','uist','barra','stornoway','harris','lewis','balivanich','north ayrshire','irvine','ardrossan','largs','saltcoats','north lanarkshire','motherwell','airdrie','coatbridge','cumbernauld','wishaw','orkney','kirkwall','stromness','perth','kinross','pitlochry','crieff','renfrewshire','paisley','renfrew','johnstone','linwood','bishopton','scottish borders','galashiels','hawick','kelso','selkirk','peebles','shetland','lerwick','whalsay','aith','south ayrshire','ayr','troon','prestwick','girvan','south lanarkshire','hamilton','east kilbride','lanark','rutherglen','stirling','dunblane','callander','west dunbartonshire','clydebank','dumbarton','alexandria','west lothian','livingston','bathgate','armadale','broxburn','stonehaven','ellon','inverurie','peterhead','fraserburgh','banchory','banff','maddiston'];
function scottishLocation(location:string){const s=location.toLowerCase().replace(/&/g,'and');if(/\b(england|wales|northern ireland|australia|overseas|remote|worldwide|northumberland|cumbria)\b/.test(s))return false;return places.some(p=>new RegExp(`(?:^|[^a-z])${p.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')}(?:$|[^a-z])`,'i').test(s))||/\b(?:AB|DD|DG|EH|FK|G|HS|IV|KA|KW|KY|ML|PA|PH|ZE)\d{1,2}[A-Z]?\s*\d[A-Z]{2}\b/i.test(s)}
// Only accept descriptions delimited by the source's advert and attachment/location headings.
function extractDescription(root:any){
 let state=0, starts=0, ends=0;const out:string[]=[];
 const start=/^(job description|advert|advertisement details|advertisement)$/i, stop=/^(job attachments|location)$/i;
 const blocks=new Set(['P','DIV','SECTION','ARTICLE','H1','H2','H3','H4','UL','OL','LI','BR','TR']);
 function visit(node:any,depth=0){if(depth>100||state===2)return;const tag=String(node.tagName||'').toUpperCase();if(['SCRIPT','STYLE','NAV','FOOTER','FORM','SVG','IFRAME'].includes(tag))return;
  if(/^H[1-6]$/.test(tag)){const label=tidy(node.textContent||'');if(start.test(label)){starts++;if(state===0){state=1;return}}if(state===1&&stop.test(label)){ends++;state=2;return}}
  if(node.nodeType===3){if(state===1)out.push(node.textContent||'');return}
  const block=blocks.has(tag);if(block&&state===1)out.push(tag==='LI'?'\n- ':'\n');for(const child of node.childNodes||[])visit(child,depth+1);if(block&&state===1)out.push('\n');
 }
 visit(root);const description=out.join('').replace(/\r/g,'').split('\n').map(s=>s.replace(/[\t ]+/g,' ').trim()).join('\n').replace(/\n{3,}/g,'\n\n').trim();
 return starts===1&&ends===1&&description.length>=120&&description.length<=30000&&!/(?:\.\.\.|…)$/.test(description)?description:null;
}
function extract(html:string,url:string,now=Date.now()){
 const safe=validUrl(url);if(!safe||html.length>2000000)return null;const root=parse(html);const title=tidy(root.querySelector('h1')?.textContent||'');
 const main=root.querySelector('main')||root.querySelector('#main-content');if(!main)return null;
 const metadata=tidy(main.textContent||'');
 const employer=/Published\s+by\s+(.+?)\s*Ref\s*:/i.exec(metadata)?.[1]?.trim();
 const pub=/Published\s+date\s*:\s*(\d{2}\/\d{2}\/\d{4})/i.exec(metadata)?.[1];
 const closing=/Closing\s+date\s*:\s*(\d{2}\/\d{2}\/\d{4})/i.exec(metadata)?.[1];
 const location=/Location\s*:\s*(.+?)\s*(?:Salary|Contract\s+type|Position\s+type|Hours|Categories)\s*:/i.exec(metadata)?.[1]?.trim();
 const salary=/Salary\s*:\s*(.+?)\s*(?:Contract\s+type|Position\s+type|Hours|Categories)\s*:/i.exec(metadata)?.[1]?.trim();
 const description=extractDescription(main);const posted=pub&&date(pub),expires=closing&&date(closing,true);
 // Exclude explicitly non-Scottish/remote locations; council pages are Scottish local-authority adverts.
 if(!title||!employer||!location||!description||!posted||!expires||+new Date(posted)>now||+new Date(expires)<=now||/\b(england|wales|northern ireland|overseas|remote|worldwide)\b/i.test(location))return null;
 if(title.length>200||employer.length>200||location.length>200||!scottishLocation(location))return null;
 const external_id=/-(\d+)$/.exec(new URL(safe).pathname)?.[1];if(!external_id)return null;
 return {external_id,title,employer,location,posted_at:posted,expires_at:expires,source_url:safe,description:(salary?`Salary: ${salary}\n\n`:'')+description};
}
async function request(url:string){const response=await fetch(url,{headers:{'User-Agent':'ScotSponsorJobImporter/1.0 (job aggregation; respects robots.txt)','Accept':'text/html'},signal:AbortSignal.timeout(8000),redirect:'error'});if(response.status===403)throw Error('blocked');if(response.status===429){const e=new Error('rate_limited');const h=response.headers.get('retry-after')||'';const n=/^\d+$/.test(h)?Number(h):Math.ceil((Date.parse(h)-Date.now())/1000);(e as Error & {retrySeconds:number}).retrySeconds=Number.isFinite(n)&&n>0?n:1800;throw e}if(!response.ok)throw Error('upstream_error');const html=await response.text();if(html.length>2000000)throw Error('upstream_error');return html}
Deno.serve(async req=>{
 if(req.method!=='POST')return Response.json({error:'Method not allowed'},{status:405});
 const token=req.headers.get('x-job-import-token')||'';if(token.length!==64)return Response.json({error:'Unauthorised'},{status:401});
 const auth=await db.rpc('scotland_job_import_authorise',{p_token:token});if(auth.error||auth.data!==true)return Response.json({error:'Unauthorised'},{status:401});
 const claim=await db.rpc('scotland_job_import_claim');if(claim.error)return Response.json({error:'Claim failed'},{status:503});if(!claim.data)return Response.json({status:'busy'}, {status:429});
 let page=claim.data.page as number,offset=claim.data.offset as number,imported=0,seen=0,result='ok',block=0;const started=Date.now();
 try{
  let list:string[]=[],lastPage=false;
  for(let scanned=0;scanned<5&&Date.now()-started<38000;scanned++){
   if(scanned)await sleep(700);
   const search=await request(`${host}/search-jobs?page=${page}`);
   const totalMatch=/Showing\s*[\d,]+\s*[-–]\s*[\d,]+\s+of\s+([\d,]+)\s+available/i.exec(tidy(parse(search).textContent||''));
   const total=totalMatch?Number(totalMatch[1].replace(/,/g,'')):null;
   if(total!==null&&page>0&&page*25>=total){page=0;offset=0;result='partial';continue}
   const parsed=searchPage(search,page);if(!parsed)throw Error('parse_error');
   list=parsed.list;lastPage=(page+1)*25>=parsed.total;if(list.length)break;
   page=page>=100||lastPage?0:page+1;offset=0;result='partial';
  }
  if(list.length&&offset>=list.length){page=page>=100||lastPage?0:page+1;offset=0}
  else for(;offset<list.length&&seen<30&&Date.now()-started<38000;offset++){
   const url=list[offset];await sleep(700);let html;try{html=await request(url)}catch(e){if(['rate_limited','blocked'].includes((e as Error).message))throw e;result='partial';continue}
   seen++;const job=extract(html,url);if(!job)continue;
   const saved=await db.rpc('save_scottish_job',{p_job:job});if(saved.error)throw Error('upstream_error');if(saved.data==='saved')imported++;
  }
  if(list.length&&offset>=list.length){page=page>=100||lastPage?0:page+1;offset=0}
  if(seen>0&&imported===0)result='parse_error';
 }catch(e){const message=(e as Error).message;if(message==='end_of_results')result='partial';else if(message==='blocked'){result='rate_limited';block=86400}else if(message==='rate_limited'){result='rate_limited';block=(e as Error & {retrySeconds?:number}).retrySeconds||1800}else result=message==='parse_error'?'parse_error':'upstream_error'}
 const done=await db.rpc('scotland_job_import_finish',{p_page:page,p_offset:offset,p_imported:imported,p_result:result,p_block_seconds:block});
 return Response.json({result,page,offset,seen,imported},{status:done.error?503:result==='ok'||result==='partial'?200:502});
});
