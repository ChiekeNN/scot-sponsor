import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('retired providers cannot be re-imported and historical submissions remain',async()=>{
 const sql=await readFile('supabase/migrations/20261101050000_remove_reed_scottish_jobs.sql','utf8');
 assert.match(sql,/delete from public.partner_jobs where source='reed'/);
 assert.match(sql,/check \(source in \('myjobscotland'\)\)/);
 assert.match(sql,/drop function if exists public.claim_reed_detail_jobs/);
 assert.doesNotMatch(sql,/delete from public.application_support_requests/);
 assert.match(sql,/listing_fingerprint=public.job_listing_fingerprint/);
 assert.match(sql,/d.updated_at>=now\(\)-interval '7 days'/);
});
test('job details omit source and editor controls without weakening complete-only protection',async()=>{
 const ui=await readFile('src/JobDetails.tsx','utf8');
 assert.doesNotMatch(ui,/Source: myjobscotland|Data reuse information|View the original listing and attachments|Super-admin: add or update full description/);
 assert.match(ui,/full_description/);
 const sql=await readFile('supabase/migrations/20261101072000_remove_job_detail_source_url.sql','utf8');
 assert.doesNotMatch(sql,/'source_url'/);assert.match(sql,/listing_fingerprint=public.job_listing_fingerprint/);assert.match(sql,/d.updated_at>=now\(\)-interval '7 days'/);
});
test('the specified footer text is removed from public and signed-in pages',async()=>{
 for(const path of ['src/App.tsx','src/Landing.tsx']){const text=await readFile(path,'utf8');assert.doesNotMatch(text,/Independent project|Not affiliated with the UK Home Office|Made for your next chapter in Scotland\./);}
});
