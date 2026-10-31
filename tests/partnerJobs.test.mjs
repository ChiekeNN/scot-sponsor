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
test('Scottish job details attribute their source and link safely to attachments',async()=>{
 const ui=await readFile('src/JobDetails.tsx','utf8');assert.match(ui,/Source: myjobscotland/);assert.match(ui,/Data reuse information/);assert.match(ui,/noopener noreferrer/);
 const sql=await readFile('supabase/migrations/20261101050000_remove_reed_scottish_jobs.sql','utf8');assert.match(sql,/source_url.*myjobscotland/);
});
