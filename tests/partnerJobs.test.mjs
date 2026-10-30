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
test('feed defaults to public read-only and application intake remains disabled',async()=>{
 const sql=await readFile('supabase/migrations/20261030233000_partner_job_feed.sql','utf8');assert.match(sql,/grant select on public.partner_jobs to anon, authenticated/);assert.doesNotMatch(sql,/grant (?:insert|update|all) on public.partner_jobs to anon/);assert.match(sql,/14 days/);
 const ui=await readFile('src/PartnerJobs.tsx','utf8');assert.match(ui,/Apply through ScotSponsor · unavailable/);assert.match(ui,/not directly to the employer/);assert.doesNotMatch(ui,/type="file"/);
});
