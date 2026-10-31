import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {transform} from 'esbuild';
import {parse} from 'node-html-parser';
import vm from 'node:vm';
const source=await readFile('supabase/functions/scotland-job-import/index.ts','utf8');
const isolated=source.replace(/^import[^\n]+\n/gm,'').replace(/const db=createClient[^\n]+\n/,'').split('Deno.serve(')[0]+'\nglobalThis.__test={links,extract,extractDescription,searchPage};';
const compiled=(await transform(isolated,{loader:'ts'})).code;
const context={parse,URL,Date,Set,globalThis:null};context.globalThis=context;vm.runInNewContext(compiled,context);
const {links,extract,searchPage}=context.__test;
const url='https://myjobscotland.gov.uk/councils/highland-council/jobs/example-role-123456';
const description='The council is looking for a qualified candidate to join our service. '.repeat(4);
const html=`<html><main><h1>Community Officer</h1><p>Published by Highland Council Ref: ABC123 Published date: 28/10/2026 Closing date: 09/11/2026</p><p>Location: Inverness Salary: £30,000 Contract type: Permanent Position type: Full Time Hours: 35 Categories: Support</p><h2>Job Description</h2><p>${description}</p><h2>Requirements</h2><p>Relevant experience is essential.</p><h2>Job Attachments</h2><p>Attachment</p></main></html>`;
test('extracts full delimited advert and verified metadata, not attachments',()=>{const job=extract(html,url,Date.parse('2026-10-31T14:00:00Z'));assert.ok(job);assert.equal(job.external_id,'123456');assert.match(job.description,/Relevant experience is essential/);assert.doesNotMatch(job.description,/Attachment/);assert.equal(job.location,'Inverness');assert.equal(job.posted_at,'2026-10-28T00:00:00.000Z')});
test('rejects missing full advert boundary, closed or non-Scottish results',()=>{assert.equal(extract(html.replace('<h2>Job Attachments</h2>',''),url,Date.parse('2026-10-31T14:00:00Z')),null);assert.equal(extract(html.replace('09/11/2026','01/10/2026'),url,Date.parse('2026-10-31T14:00:00Z')),null);assert.equal(extract(html.replace('Inverness Salary','London, England Salary'),url,Date.parse('2026-10-31T14:00:00Z')),null);assert.equal(extract(html.replace('Inverness Salary','Scotland Gate, Northumberland Salary'),url,Date.parse('2026-10-31T14:00:00Z')),null);assert.equal(extract(html.replace('Inverness Salary','Liverpool Salary'),url,Date.parse('2026-10-31T14:00:00Z')),null);assert.ok(extract(html.replace('28/10/2026','01/01/2026'),url,Date.parse('2026-10-31T14:00:00Z')))});
test('accepts only council detail links on the fixed source host',()=>{const list=links(`<a href="/councils/highland-council/jobs/example-role-123456">a</a><a href="https://evil.test/councils/highland-council/jobs/example-role-123456">b</a><a href="/search/secret">c</a>`);assert.equal(list.length,1);assert.equal(list[0],url)});
test('database access, protection and scheduling are service-only',async()=>{const sql=await readFile('supabase/migrations/20261101060000_scottish_job_import.sql','utf8');assert.match(sql,/revoke all on function public\.scotland_job_import_authorise/);assert.match(sql,/partner_detail_exclusions/);assert.match(sql,/origin='provider'/);const cron=await readFile('supabase/migrations/20261101062000_schedule_scottish_jobs.sql','utf8');assert.match(cron,/\*\/3 \* \* \* \*/);assert.match(cron,/vault\.decrypted_secrets/)});


test('safely skips a verified result page with no council jobs, but fails closed on changed or blocked pages',()=>{
 const other='<a href="/adult-care/example/jobs/support-worker-123456">Role</a>';
 assert.equal(searchPage(`<h2>Showing 2126 - 2150 of 2229 available jobs</h2>${other}`,85).list.length,0);
 assert.equal(searchPage(`<h2>Showing 2126 - 2150 of 2229 available jobs</h2>${other}`,84),null);
 assert.equal(searchPage('<h2>Showing 2126 - 2150 of 2229 available jobs</h2><p>Blocked</p>',85),null);
 assert.equal(searchPage(`<p>Access denied</p>${other}`,85),null);
 const mixed=searchPage(`<h2>Showing 1 - 25 of 2229 available jobs</h2>${other}<a href="${url}">Council job</a>`,0);
 assert.equal(mixed.list.length,1);assert.equal(mixed.total,2229);
});

test('latest schedule is three minutes and keeps Vault authorization',async()=>{
 const sql=await readFile('supabase/migrations/20261101083000_three_minute_job_import.sql','utf8');
 assert.match(sql,/\*\/3 \* \* \* \*/);assert.match(sql,/vault\.decrypted_secrets/);
});

test('import run moves across ineligible result pages and wraps safely without fetching unrelated adverts',async()=>{
 const calls=[];let finished;let handler;
 const fakeDb={rpc:async(name,args)=>{
  if(name==='scotland_job_import_authorise')return {data:true};
  if(name==='scotland_job_import_claim')return {data:{page:85,offset:0}};
  if(name==='scotland_job_import_finish'){finished=args;return {data:null};}
  throw new Error(`unexpected RPC: ${name}`);
 }};
 const runSource=source.replace(/^import[^\n]+\n/gm,'').replace(/const db=createClient[^\n]+\n/,'const db=globalThis.fakeDb;\n');
 const runCompiled=(await transform(runSource,{loader:'ts'})).code;
 const sandbox={parse,URL,Date,Set,Response,AbortSignal,fakeDb,setTimeout:fn=>{fn();return 0},Deno:{serve:fn=>{handler=fn}},fetch:async url=>{
  calls.push(url);const page=Number(new URL(url).searchParams.get('page'));const first=page*25+1,last=Math.min(first+24,2229);
  return {ok:true,status:200,text:async()=>`<h2>Showing ${first} - ${last} of 2229 available jobs</h2><a href="/adult-care/example/jobs/support-worker-123456">Role</a>`};
 },globalThis:null};sandbox.globalThis=sandbox;
 vm.runInNewContext(runCompiled,sandbox);
 const result=await handler({method:'POST',headers:new Headers({'x-job-import-token':'a'.repeat(64)})});
 assert.equal(result.status,200);assert.equal(finished.p_page,0);assert.equal(finished.p_offset,0);assert.equal(finished.p_result,'partial');
 assert.equal(calls.length,5);assert.ok(calls.every(url=>new URL(url).pathname==='/search-jobs'));
});

// A current Aberdeenshire advert at Westhill Academy has a full on-page job description.
test('accepts Westhill while retaining country and complete-description checks',()=>{
 const westhill=html.replace('Inverness Salary','Westhill Academy, Westhill Salary');
 assert.equal(extract(westhill,url,Date.parse('2026-10-31T14:00:00Z')).location,'Westhill Academy, Westhill');
 assert.equal(extract(westhill.replace('Westhill Academy, Westhill Salary','Westhill, England Salary'),url,Date.parse('2026-10-31T14:00:00Z')),null);
 assert.equal(extract(westhill.replace('<h2>Job Attachments</h2>',''),url,Date.parse('2026-10-31T14:00:00Z')),null);
});

test('daily scan starts tomorrow at 11pm Lagos, chains bounded pages and keeps the importer private',async()=>{
 const sql=await readFile('supabase/migrations/20261101120000_daily_scottish_job_batches.sql','utf8');
 assert.match(sql,/'0 22 \* \* \*'/);assert.match(sql,/Africa\/Lagos/);assert.match(sql,/daily_start_on/);
 assert.match(sql,/scotland_job_start_batch\('daily'\)/);assert.match(sql,/scotland_job_queue_page\(\)/);
 assert.match(sql,/p_result not in \('ok','partial'\)/);assert.match(sql,/batch_steps>=150/);
 assert.match(sql,/revoke all on function public\.scotland_job_queue_page\(\) from public,anon,authenticated/);
 assert.match(sql,/revoke all on function public\.scotland_job_start_batch\(text\) from public,anon,authenticated/);
});
