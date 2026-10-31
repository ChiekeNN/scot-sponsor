import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {descriptionText,reedDetailPayload,fetchReedDetail} from '../lib/reed-details.js';
import {makeDetailHandler} from '../api/cron/fetch-full-job-details.js';
const job={id:'opaque',external_id:'123',listing_fingerprint:'fingerprint'};
const detail={jobId:123,jobTitle:'Engineer',employerName:'Example',locationName:'Glasgow',jobDescription:'<p>A complete &amp; factual description.</p><ul><li>Work in Scotland</li><li>Apply your experience</li></ul><script>secret()</script>',expirationDate:'12/11/2026',currency:'GBP',minimumSalary:30000,maximumSalary:40000,salaryType:'PerAnnum',contractType:'Permanent',fullTime:true,partTime:false};
const response=()=>({setHeader(){},end(s){this.body=JSON.parse(s)}});
test('full descriptions retain readable text and bullets without executable HTML',()=>{
 const result=descriptionText(detail.jobDescription);assert.match(result,/complete & factual description/);assert.match(result,/• Work in Scotland/);assert.doesNotMatch(result,/<script>|secret\(\)/);assert.equal(descriptionText('short'),null);assert.equal(descriptionText('x'.repeat(30001)),null);
});
test('details require exact job identity, avoid invented information and reject truncation',()=>{
 const p=reedDetailPayload(job,detail);assert.equal(p.p_fingerprint,'fingerprint');assert.equal(p.p_expires_at,'2026-11-12T23:59:59.999Z');assert.equal(p.p_salary_period,'year');assert.equal(p.p_contract_time,'full_time');assert.equal(p.p_contract_type,'permanent');
 assert.equal(reedDetailPayload(job,{...detail,jobId:124}),null);assert.equal(reedDetailPayload({...job,external_id:'../123'},detail),null);assert.equal(reedDetailPayload(job,{...detail,jobDescription:'x'.repeat(30001)}),null);
 const incomplete=reedDetailPayload(job,{...detail,expirationDate:'30/02/2026',currency:'EUR',contractType:'made-up',fullTime:false,partTime:false});assert.equal(incomplete.p_expires_at,null);assert.equal(incomplete.p_salary_min,null);assert.equal(incomplete.p_salary_period,null);assert.equal(incomplete.p_contract_type,null);assert.equal(incomplete.p_contract_time,null);
});
test('detail fetch uses fixed HTTPS host and basic authentication without exposing its key',async()=>{
 let called=0;const payload=await fetchReedDetail(job,{apiKey:'test-secret',request:async(url,options)=>{called++;assert.equal(url,'https://www.reed.co.uk/api/1.0/jobs/123');assert.equal(options.headers.Authorization,`Basic ${Buffer.from('test-secret:').toString('base64')}`);assert.equal(options.redirect,'error');return {ok:true,json:async()=>detail}}});assert.equal(called,1);assert.doesNotMatch(JSON.stringify(payload),/test-secret/);
 await assert.rejects(()=>fetchReedDetail(job,{apiKey:'x',request:async()=>({status:429,ok:false})}),/RATE_LIMITED/);
});
test('only cron or super-admin can trigger the details job',async()=>{
 const member=()=>({auth:{getUser:async()=>({data:{user:{id:'member'}}})},rpc:async()=>({data:false})});let requests=0;
 const h=makeDetailHandler({env:{CRON_SECRET:'secret'},create:member,request:async()=>{requests++;throw Error('unexpected')}});let r=response();await h({method:'GET',headers:{authorization:'Bearer wrong'}},r);assert.equal(r.statusCode,401);r=response();await h({method:'POST',headers:{authorization:'Bearer member-token'}},r);assert.equal(r.statusCode,403);assert.equal(requests,0);
 r=response();await h({method:'GET',headers:{authorization:'Bearer secret'}},r);assert.equal(r.statusCode,503);assert.doesNotMatch(JSON.stringify(r.body),/secret/);
});
test('import saves valid descriptions, stops on rate limits and uses a bounded claim',async()=>{
 const calls=[];const client={rpc:async(name,args)=>{calls.push([name,args]);if(name==='reserve_partner_job_sync')return {data:true};if(name==='claim_reed_detail_jobs')return {data:[job,{...job,id:'second',external_id:'124'},{...job,id:'third',external_id:'125'}]};if(name==='save_reed_job_detail')return {data:'saved'};if(name==='block_reed_detail_import')return {data:null};throw Error('unexpected rpc')}};
 let n=0;const h=makeDetailHandler({env:{CRON_SECRET:'cron',SUPABASE_SERVICE_ROLE_KEY:'service',REED_API_KEY:'key'},create:()=>client,request:async()=>{n++;return n===1?{ok:true,json:async()=>detail}:{ok:false,status:429}}});const r=response();await h({method:'GET',headers:{authorization:'Bearer cron'}},r);assert.equal(r.statusCode,503);assert.deepEqual(r.body,{attempted:2,saved:1,expired:0,failed:1,remaining:1,rateLimited:true});assert.equal(n,2);assert.equal(calls.find(c=>c[0]==='block_reed_detail_import')[1].p_seconds,1800);assert.equal(calls.find(c=>c[0]==='claim_reed_detail_jobs')[1].p_limit,30);assert.doesNotMatch(JSON.stringify(r.body),/key|service|cron/);
});
test('database import is service-only, protects manual edits and expires stale provider descriptions',async()=>{
 const sql=await readFile('supabase/migrations/20261031235000_reed_full_job_details.sql','utf8');assert.match(sql,/revoke all on function public\.claim_reed_detail_jobs\(integer\) from public, anon, authenticated/i);assert.match(sql,/for update of j skip locked/i);assert.match(sql,/where public\.job_complete_descriptions\.origin='provider'/i);assert.match(sql,/origin='manual'/i);assert.match(sql,/partner_detail_exclusions/i);assert.match(sql,/block_reed_detail_import/i);assert.match(sql,/p_fingerprint is distinct from/i);assert.match(sql,/d\.updated_at>=now\(\)-interval '7 days'/i);assert.match(sql,/j\.expires_at is null or j\.expires_at>now\(\)/i);
});
