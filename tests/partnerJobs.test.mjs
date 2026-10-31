import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normaliseJob,collectSource} from '../lib/partner-jobs.js';
import {makeSyncHandler} from '../api/cron/sync-partner-jobs.js';
const now=Date.parse('2026-10-30T12:00:00Z');
const ad={id:'123',title:'Engineer',description:'Job description',location:{display_name:'Glasgow, Scotland',area:['UK','Scotland','Glasgow']},created:'2026-10-29T12:00:00Z',redirect_url:'https://www.adzuna.co.uk/jobs/land/ad/123',company:{display_name:'Employer'}};
const reed={jobId:55,jobTitle:'Engineer',locationName:'Edinburgh, Scotland',date:'29/10/2026',jobUrl:'https://www.reed.co.uk/jobs/example/55',jobDescription:'Example',employerName:'Employer'};
test('normalises valid recent Scotland records and excludes uncertain or unsafe data',()=>{
 assert.equal(normaliseJob('adzuna',ad,now).title,'Engineer');assert.equal(normaliseJob('reed',reed,now).source,'reed');
 assert.equal(normaliseJob('reed',{...reed,locationName:'Scotland Gate, Northumberland'},now),null);
 assert.equal(normaliseJob('adzuna',{...ad,location:{display_name:'Remote UK',area:['UK']}},now),null);
 assert.equal(normaliseJob('adzuna',{...ad,created:'2026-09-01T00:00:00Z'},now),null);
 assert.equal(normaliseJob('reed',{...reed,jobUrl:'https://evil.example/'},now),null);
 assert.equal(normaliseJob('reed',{...reed,date:'30/02/2026'},now),null);
});
test('source collectors enforce credentials, record bounds and do not send secrets to clients',async()=>{
 await assert.rejects(()=>collectSource('reed',{env:{}}),/NOT_CONFIGURED/);
 let calls=0;const request=async(url)=>{calls++;assert.match(url,/api\.adzuna\.com/);return {ok:true,json:async()=>({results:[ad]})}};
 const out=await collectSource('adzuna',{request,env:{ADZUNA_APP_ID:'id',ADZUNA_APP_KEY:'secret'},now});assert.equal(out.jobs.length,1);assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(out),/secret/);
});
test('cron requires secret and never reveals it',async()=>{
 const res={setHeader(){},end(s){this.body=JSON.parse(s)}};await makeSyncHandler({env:{CRON_SECRET:'secret'}})({method:'GET',headers:{authorization:'Bearer wrong'}},res);assert.equal(res.statusCode,401);assert.doesNotMatch(JSON.stringify(res.body),/secret/);
});
test('feed is read-only and support requests stay private',async()=>{
 const sql=await readFile('supabase/migrations/20261030233000_partner_job_feed.sql','utf8');assert.match(sql,/grant select on public.partner_jobs to anon, authenticated/);assert.doesNotMatch(sql,/grant (?:insert|update|all) on public.partner_jobs to anon/);
 const intake=await readFile('supabase/migrations/20261031201500_application_support.sql','utf8');assert.match(intake,/not public.can_access_job_hunt/);assert.match(intake,/not public.is_super_admin/);assert.match(intake,/revoke all on public.application_support_requests from public, anon, authenticated/);assert.match(intake,/90 days/);
 const ui=await readFile('src/ApplicationSupport.tsx','utf8');assert.match(ui,/not an application to the employer/);assert.match(ui,/File uploads are not available/);assert.doesNotMatch(ui,/type="file"/);
 const feed=await readFile('src/PartnerJobs.tsx','utf8');assert.doesNotMatch(feed,/View source &amp; apply/);assert.doesNotMatch(feed,/adzuna/i);assert.match(feed,/public_job_list/);
});
test('Adzuna ingestion can import over 500 distinct Scotland jobs',async()=>{
 let pages=0;const request=async(url)=>{pages++;const page=Number(new URL(url).pathname.split('/').pop());return {ok:true,json:async()=>({results:page<=12?Array.from({length:50},(_,i)=>({...ad,id:String((page-1)*50+i),redirect_url:`http://adzuna.co.uk/jobs/land/ad/${(page-1)*50+i}`})):[]})}};
 const out=await collectSource('adzuna',{request,env:{ADZUNA_APP_ID:'id',ADZUNA_APP_KEY:'secret'},now});
 assert.equal(out.jobs.length,600);assert.equal(pages,13);assert.equal(out.jobs[0].source_url.startsWith('https://adzuna.co.uk/'),true);
});
test('manual sync is restricted to authenticated super-admins',async()=>{
 const res=()=>({setHeader(){},end(s){this.body=JSON.parse(s)}});let r=res();let calls=0;
 const create=()=>({auth:{getUser:async()=>({data:{user:{id:'member'}}})},rpc:async(name)=>{assert.equal(name,'is_super_admin');return {data:false}}});
 const handler=makeSyncHandler({env:{},create,request:async()=>{calls++;throw Error('should not fetch')}});
 await handler({method:'POST',headers:{}},r);assert.equal(r.statusCode,401);
 r=res();await handler({method:'POST',headers:{authorization:'Bearer member-token'}},r);assert.equal(r.statusCode,403);assert.equal(calls,0);
});
test('job UI supports more than 500 and the sync lock is service-only',async()=>{
 const ui=await readFile('src/PartnerJobs.tsx','utf8');assert.match(ui,/p_offset:1000,p_limit:1000/);assert.match(ui,/setShown\(n=>n\+50\)/);assert.match(ui,/isAdmin&&/);
 const sql=await readFile('supabase/migrations/20261031200000_partner_sync_reservation.sql','utf8');assert.match(sql,/revoke all on function public.reserve_partner_job_sync\(\) from public, anon, authenticated/);assert.match(sql,/90 seconds/);
});

test('job details preserve factual salary and contract fields without assuming missing values',()=>{
 const job=normaliseJob('adzuna',{...ad,salary_min:30000,salary_max:40000,salary_is_predicted:1,contract_type:'permanent',contract_time:'full_time'},now);assert.equal(job.salary_min,30000);assert.equal(job.salary_max,40000);assert.equal(job.salary_is_predicted,true);assert.equal(job.contract_type,'permanent');
 const missing=normaliseJob('adzuna',{...ad,salary_min:-99,salary_max:1e20},now);assert.equal(missing.salary_min,null);assert.equal(missing.salary_max,null);
});
