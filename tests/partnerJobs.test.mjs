import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {normaliseJob,collectSource} from '../lib/partner-jobs.js';
import {makeSyncHandler} from '../api/cron/sync-partner-jobs.js';
const now=Date.parse('2026-10-30T12:00:00Z');
const reed={jobId:55,jobTitle:'Engineer',locationName:'Edinburgh, Scotland',date:'29/10/2026',jobUrl:'https://www.reed.co.uk/jobs/example/55',jobDescription:'Example',employerName:'Employer'};
test('normalises recent Scottish records and excludes foreign, uncertain or unsafe data',()=>{
 assert.equal(normaliseJob('reed',reed,now).source,'reed');
 for(const place of ['Hawick, Scottish Borders','Lerwick, Shetland Islands','Kirkwall, Orkney Islands','Stornoway, Western Isles','Dunbar, East Lothian'])assert.ok(normaliseJob('reed',{...reed,locationName:place},now),place);
 for(const place of ['Scotland Gate, Northumberland','Hamilton, England','Perth, Australia','London, England','Cardiff, Wales','Belfast, Northern Ireland','Unknown'])assert.equal(normaliseJob('reed',{...reed,locationName:place},now),null,place);
 assert.equal(normaliseJob('other',reed,now),null);
 assert.equal(normaliseJob('reed',{...reed,jobUrl:'https://evil.example/'},now),null);
 assert.equal(normaliseJob('reed',{...reed,date:'30/02/2026'},now),null);
 assert.equal(normaliseJob('reed',{...reed,date:'01/09/2026'},now),null);
});
test('source collector enforces credentials, location and bounded pagination',async()=>{
 await assert.rejects(()=>collectSource('reed',{env:{}}),/NOT_CONFIGURED/);
 await assert.rejects(()=>collectSource('other',{env:{}}),/UNKNOWN_SOURCE/);
 let calls=0;const request=async(url,options)=>{calls++;assert.equal(new URL(url).searchParams.get('locationName'),'Scotland');assert.ok(options.headers.Authorization.startsWith('Basic '));return {ok:true,json:async()=>({results:[reed]})}};
 const out=await collectSource('reed',{request,env:{REED_API_KEY:'secret'},now});assert.equal(out.jobs.length,1);assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(out),/secret/);
});
test('cron requires secret and never reveals it',async()=>{
 const res={setHeader(){},end(s){this.body=JSON.parse(s)}};await makeSyncHandler({env:{CRON_SECRET:'secret'}})({method:'GET',headers:{authorization:'Bearer wrong'}},res);assert.equal(res.statusCode,401);assert.doesNotMatch(JSON.stringify(res.body),/secret/);
});
test('feed is read-only and support requests stay private',async()=>{
 const sql=await readFile('supabase/migrations/20261030233000_partner_job_feed.sql','utf8');assert.match(sql,/grant select on public.partner_jobs to anon, authenticated/);assert.doesNotMatch(sql,/grant (?:insert|update|all) on public.partner_jobs to anon/);
 const intake=await readFile('supabase/migrations/20261031201500_application_support.sql','utf8');assert.match(intake,/not public.can_access_job_hunt/);assert.match(intake,/not public.is_super_admin/);assert.match(intake,/revoke all on public.application_support_requests from public, anon, authenticated/);assert.match(intake,/90 days/);
 const ui=await readFile('src/JobDetails.tsx','utf8');assert.doesNotMatch(ui,/ApplicationSupport|request_application_support_for_job/);
 const feed=await readFile('src/PartnerJobs.tsx','utf8');assert.doesNotMatch(feed,/View source &amp; apply/);assert.doesNotMatch(feed,/adzuna/i);assert.match(feed,/public_job_search/);
});
test('manual sync is restricted to authenticated super-admins',async()=>{
 const res=()=>({setHeader(){},end(s){this.body=JSON.parse(s)}});let r=res();let calls=0;
 const create=()=>({auth:{getUser:async()=>({data:{user:{id:'member'}}})},rpc:async(name)=>{assert.equal(name,'is_super_admin');return {data:false}}});
 const handler=makeSyncHandler({env:{},create,request:async()=>{calls++;throw Error('should not fetch')}});
 await handler({method:'POST',headers:{}},r);assert.equal(r.statusCode,401);
 r=res();await handler({method:'POST',headers:{authorization:'Bearer member-token'}},r);assert.equal(r.statusCode,403);assert.equal(calls,0);
});
test('job UI supports more than 500 and the sync lock is service-only',async()=>{
 const ui=await readFile('src/PartnerJobs.tsx','utf8');assert.match(ui,/p_offset:page\*50,p_limit:50/);assert.match(ui,/setPage\(n=>n\+1\)/);assert.match(ui,/isAdmin&&/);
 const sql=await readFile('supabase/migrations/20261031200000_partner_sync_reservation.sql','utf8');assert.match(sql,/revoke all on function public.reserve_partner_job_sync\(\) from public, anon, authenticated/);assert.match(sql,/90 seconds/);
});

test('job detail candidates preserve valid salary without inventing contract data',()=>{
 const job=normaliseJob('reed',{...reed,minimumSalary:30000,maximumSalary:40000},now);assert.equal(job.salary_min,30000);assert.equal(job.salary_max,40000);assert.equal(job.contract_type,null);
 const missing=normaliseJob('reed',{...reed,minimumSalary:-99,maximumSalary:1e20},now);assert.equal(missing.salary_min,null);assert.equal(missing.salary_max,null);
});
test('retired source cannot be re-imported by an older deployment',async()=>{
 const sql=await readFile('supabase/migrations/20261101040000_scotland_jobs_remove_adzuna.sql','utf8');assert.match(sql,/delete from public.partner_jobs where source='adzuna'/);assert.match(sql,/check \(source in \('reed'\)\)/);assert.match(sql,/drop function if exists public.import_adzuna_full_description/);
});
