import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildSwitchPlan} from '../lib/switch-planner.js';
import {makeJobHuntHandler} from '../api/job-hunt-tools.js';

test('planner produces deterministic milestone dates, handles leap years and custom targets',()=>{
 const p=buildSwitchPlan('2028-03-15','2028-03-01');assert.equal(p.target,'2028-03-01');assert.equal(p.milestones[4].date,'2028-03-01');assert.equal(p.milestones[3].date,'2028-01-31');assert.equal(p.milestones[5].date,'2028-03-15');assert.equal(p.defaultTarget,false);
 const d=buildSwitchPlan('2028-03-15','');assert.equal(d.target,'2028-02-14');assert.equal(d.defaultTarget,true);
});
test('planner rejects invalid, missing and same-day or later targets',()=>{
 for(const [a,b] of [['2027-02-29',''],['not-a-date',''],['2028-03-01','2028-03-01'],['2028-03-01','2028-03-02']])assert.throws(()=>buildSwitchPlan(a,b));
});
const res=()=>({headers:{},setHeader(k,v){this.headers[k]=v},end(body){this.body=JSON.parse(body)}});
function mockClient({allowed=true,valid=true,quota=true}={}){return ()=>({auth:{getUser:async()=>valid?{data:{user:{id:'test'}}}:{error:true}},rpc:async name=>name==='can_access_job_hunt'?{data:allowed}:name==='consume_cover_letter_attempt'?{data:quota}:{error:true}})}
const req=(body,token='token')=>({method:'POST',headers:token?{authorization:`Bearer ${token}`}:{},body});
const letterBody={kind:'cover',role:'Analyst',company:'Company',experience:'I built reports.',jobDescription:'Build reports',consent:true};
test('planner requires authentication and a Job Hunt Pass before calculating',async()=>{
 let r=res();await makeJobHuntHandler({create:mockClient()})(req({kind:'planner',expiry:'2028-03-15'},''),r);assert.equal(r.statusCode,401);
 r=res();await makeJobHuntHandler({create:mockClient({allowed:false})})(req({kind:'planner',expiry:'2028-03-15'}),r);assert.equal(r.statusCode,403);
 r=res();await makeJobHuntHandler({create:mockClient()})(req({kind:'planner',expiry:'2028-03-15'}),r);assert.equal(r.statusCode,200);assert.equal(r.body.target,'2028-02-14');
});
test('AI fails safely when unconfigured or without consent and does not call provider',async()=>{
 let calls=0;const request=async()=>{calls++;throw Error('should not run')};let r=res();await makeJobHuntHandler({create:mockClient(),request,aiKey:''})(req(letterBody),r);assert.equal(r.statusCode,503);assert.equal(calls,0);
 r=res();await makeJobHuntHandler({create:mockClient(),request,aiKey:'secret'})(req({...letterBody,consent:false}),r);assert.equal(r.statusCode,400);assert.equal(calls,0);
 r=res();await makeJobHuntHandler({create:mockClient(),request,aiKey:'secret'})(req({...letterBody,experience:'a'.repeat(4001)}),r);assert.equal(r.statusCode,400);assert.equal(calls,0);
});
test('AI rate limit fails closed and request asks provider not to invent',async()=>{
 let calls=0;const request=async(url,opts)=>{calls++;const body=JSON.parse(opts.body);assert.equal(url,'https://api.openai.com/v1/chat/completions');assert.match(body.messages[0].content,/Do not invent/);assert.match(body.messages[1].content,/built reports/);return {ok:true,json:async()=>({choices:[{message:{content:'Dear hiring manager'}}]})}};
 let r=res();await makeJobHuntHandler({create:mockClient({quota:false}),request,aiKey:'secret'})(req(letterBody),r);assert.equal(r.statusCode,429);assert.equal(calls,0);
 r=res();await makeJobHuntHandler({create:mockClient(),request,aiKey:'secret'})(req(letterBody),r);assert.equal(r.statusCode,200);assert.equal(r.body.letter,'Dear hiring manager');assert.equal(calls,1);assert.doesNotMatch(JSON.stringify(r.body),/secret/);
});
test('AI provider failures do not expose upstream body or credentials',async()=>{
 const r=res();await makeJobHuntHandler({create:mockClient(),aiKey:'secret',request:async()=>({ok:false,status:401})})(req(letterBody),r);assert.equal(r.statusCode,502);assert.doesNotMatch(JSON.stringify(r.body),/secret|401/);
});
test('admin analytics and quota are secured server-side and both features are in plan',async()=>{
 const sql=await readFile('supabase/migrations/20261030230000_admin_analytics_cover_quota.sql','utf8');assert.match(sql,/if not public\.is_super_admin\(\) then raise exception/i);assert.match(sql,/revoke all on function public\.admin_platform_analytics\(\) from public, anon/i);assert.match(sql,/if not public\.can_access_job_hunt\(\)/i);assert.match(sql,/attempts < 10/);
 const plans=await readFile('src/plans.ts','utf8');assert.match(plans,/AI cover letter generator/i);assert.match(plans,/Graduate Visa Switch Planner/i);
});
