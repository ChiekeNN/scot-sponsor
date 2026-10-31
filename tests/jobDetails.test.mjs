import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';

test('job details reject incomplete descriptions and show complete source text',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'detail-test-'));
 const originalDocument=globalThis.document;
 try{
  globalThis.document={body:{style:{overflow:''}},activeElement:null,addEventListener(){},removeEventListener(){}};
  const data={id:'a',title:'Engineer',employer:'Company',location:'Glasgow',posted_at:'2026-10-30T12:00:00Z',excerpt:'Partial description',full_description:null,salary_min:30000,salary_max:40000,salary_is_predicted:true,contract_type:'permanent',contract_time:'full_time'};
  globalThis.__detailClient={rpc:async(name,params)=>{assert.equal(name,'public_job_detail');return {data:{...data,id:params.p_job_id,full_description:params.p_job_id==='b'?'Summary\nA genuinely complete description.\n\nKey Responsibilities\n- Count goods accurately.\n- Keep records current.':null},error:null}}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__detailClient;');
  const source=await readFile('src/JobDetails.tsx','utf8');const compiled=await transformWithEsbuild(source,'src/JobDetails.tsx',{jsx:'automatic'});const path=join(dir,'details.mjs');await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"').replace('"./jobDescription.mjs"',JSON.stringify(pathToFileURL(join(process.cwd(),'src/jobDescription.mjs')).href)));
  const {JobDetails}=await import(pathToFileURL(path).href);const props={id:'a',title:'Engineer',isAdmin:false,onClose(){}};let view;
  await act(async()=>{view=create(React.createElement(JobDetails,props))});let output=JSON.stringify(view.toJSON());assert.doesNotMatch(output,/Partial description|Only a partial description|Request personal application support|Privacy and retention|Send request to ScotSponsor/);assert.match(output,/no longer available/);
  await act(async()=>{view.update(React.createElement(JobDetails,{...props,id:'b'}))});output=JSON.stringify(view.toJSON());assert.match(output,/A genuinely complete description/);assert.match(output,/Key Responsibilities/);assert.match(output,/estimate/);assert.match(output,/pay period not specified/);assert.equal(view.root.findAllByType('li').length,2);assert.equal(view.root.findAllByType('h4').length,2);assert.doesNotMatch(output,/Only a partial description/);assert.equal(view.root.findAllByType('a').length,0);await act(async()=>{view.unmount()});
 }finally{delete globalThis.__detailClient;if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;await rm(dir,{recursive:true,force:true})}
});

test('complete job descriptions are admin-only and disappear when the source listing changes',async()=>{
 const sql=await readFile('supabase/migrations/20261031230000_job_detail_views.sql','utf8');assert.match(sql,/if not public\.is_super_admin\(\)/i);assert.match(sql,/revoke all on public\.job_complete_descriptions from public, anon, authenticated/i);assert.match(sql,/listing_fingerprint=public\.job_listing_fingerprint/i);assert.match(sql,/p_confirm is distinct from true/i);
});


test('public database views require a current matching complete description',async()=>{
 const sql=await readFile('supabase/migrations/20261101010000_complete_jobs_only.sql','utf8');
 assert.match(sql,/revoke all on function public\.is_current_partner_job\(uuid\) from public, anon, authenticated/i);
 for(const name of ['public_job_list','public_job_detail']) { const body=sql.split('create or replace function public.'+name)[1].split('$$;')[0]; assert.match(body,/join public\.job_complete_descriptions d/i); assert.match(body,/listing_fingerprint=public\.job_listing_fingerprint/i); assert.match(body,/d\.updated_at>=now\(\)-interval '7 days'/i); }
 assert.match(sql,/not public\.is_current_partner_job\(j\.public_id\)/i);
});
