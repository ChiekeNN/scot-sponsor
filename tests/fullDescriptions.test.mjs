import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {descriptionBlocks} from '../src/jobDescription.mjs';
import {validateFullRecords,buildImportPayload,importFullRecords} from '../lib/adzuna-full-import.js';
const now=Date.parse('2026-10-31T13:00:00Z');
const record={external_id:'12345',title:'Warehouse Assistant',employer:'Example Company',location:'Inverness, Scotland',full_description:'Summary\nSupport warehouse operations.\n\nKey Responsibilities\n- Keep accurate records.\n- Coordinate goods movements.',observed_at:'2026-10-31T12:00:00Z',complete:true};
const job={public_id:'job-1',source:'adzuna',external_id:'12345',title:'Warehouse Assistant',employer:'Example Company',location:'Inverness, Scotland',description:'A short source excerpt...'};
test('description formatting preserves supplied headings, paragraphs and bullet content',()=>{
 const result=descriptionBlocks(record.full_description);assert.deepEqual(result,[{type:'heading',text:'Summary'},{type:'paragraph',text:'Support warehouse operations.'},{type:'heading',text:'Key Responsibilities'},{type:'list',items:['Keep accurate records.','Coordinate goods movements.']}]);
 const more=descriptionBlocks('**Preferred** **Qualifications**\n- Relevant experience.\n\nPay Range: £23–26/hour\nEqual opportunity.');assert.deepEqual(more,[{type:'heading',text:'**Preferred** **Qualifications**'},{type:'list',items:['Relevant experience.']},{type:'paragraph',text:'Pay Range: £23–26/hour\nEqual opportunity.'}]);
});
test('full record import requires explicit completeness, validated identity and recent observation',()=>{
 assert.equal(validateFullRecords([record],now).length,1);
 for(const invalid of [{...record,complete:false},{...record,external_id:'../12345'},{...record,location:''},{...record,observed_at:'2026-10-01T00:00:00Z'},{...record,observed_at:'2026-11-01T00:00:00Z'},{...record,full_description:'short'},{...record,full_description:'x'.repeat(30001)}])assert.throws(()=>validateFullRecords([invalid],now));
 assert.throws(()=>validateFullRecords([record,record],now),/INVALID_RECORD/);
});
test('record matching rejects mismatched job identity and snippets, without guessing',()=>{
 const payload=buildImportPayload(validateFullRecords([record],now)[0],job);assert.equal(payload.p_job_id,'job-1');assert.equal(payload.p_excerpt,job.description);
 assert.equal(buildImportPayload(record,{...job,location:'London'}),null);assert.equal(buildImportPayload(record,{...job,source:'reed'}),null);assert.equal(buildImportPayload(record,{...job,title:'Another role'}),null);assert.equal(buildImportPayload({...record,full_description:job.description},job),null);
});
test('licensed export import defaults to dry-run and only writes exact matched listings',async()=>{
 const calls=[];const client={from(table){assert.equal(table,'partner_jobs');return {select(){return this},eq(){return this},async in(_field,ids){assert.deepEqual(ids,['12345','789']);return {data:[job],error:null}}}},async rpc(name,payload){calls.push([name,payload]);return {data:'saved'}}};
 const records=validateFullRecords([record,{...record,external_id:'789'}],now);
 const dry=await importFullRecords(records,client);assert.equal(dry.matched,1);assert.equal(dry.saved,0);assert.equal(dry.skipped,1);assert.equal(calls.length,0);
 const result=await importFullRecords(records,client,{apply:true});assert.equal(result.saved,1);assert.equal(result.skipped,1);assert.equal(calls.length,1);assert.equal(calls[0][0],'import_adzuna_full_description');
});
test('database import is service-only and protects stale, changed, or manually removed content',async()=>{
 const sql=await readFile('supabase/migrations/20261101000000_import_complete_job_descriptions.sql','utf8');assert.match(sql,/revoke all on function public\.import_adzuna_full_description.*from public, anon, authenticated/i);assert.match(sql,/p_excerpt is distinct from j\.description/i);assert.match(sql,/origin='provider'/i);assert.match(sql,/partner_detail_exclusions/i);assert.match(sql,/p_observed_at < now\(\)-interval '7 days'/i);
});
