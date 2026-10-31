import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';

test('job descriptions are editable only in super-admin UI and save the selected job',async()=>{
 const base=join(process.cwd(),'node_modules','.cache');await mkdir(base,{recursive:true});
 const dir=await mkdtemp(join(base,'job-details-'));const previousDocument=globalThis.document;const calls=[];
 let fullDescription='Summary\nA complete description of this real role.\n\nRequirements\n- Relevant experience.';
 try{
  globalThis.document={activeElement:null,body:{style:{overflow:''}},addEventListener(){},removeEventListener(){}};
  globalThis.__detailsClient={rpc:async(name,args)=>{
   calls.push({name,args});
   if(name==='admin_save_job_full_description'){fullDescription=args.p_description;return {data:null,error:null};}
   return {data:{id:'one',title:'Teacher',employer:'Council',location:'Inverness',posted_at:'2026-10-31T00:00:00Z',expires_at:null,salary_min:null,salary_max:null,salary_is_predicted:null,salary_period:null,contract_type:null,contract_time:null,source_url:'https://myjobscotland.gov.uk/example',full_description:fullDescription},error:null};
  }};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__detailsClient;');
  const source=await readFile('src/JobDetails.tsx','utf8');const compiled=await transformWithEsbuild(source,'src/JobDetails.tsx',{jsx:'automatic'});const path=join(dir,'JobDetails.mjs');
  await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"').replace('"./jobDescription.mjs"',JSON.stringify(pathToFileURL(join(process.cwd(),'src/jobDescription.mjs')).href)));
  const {JobDetails}=await import(pathToFileURL(path).href);
  let visitor;await act(async()=>{visitor=create(React.createElement(JobDetails,{id:'one',title:'Teacher',onClose(){}}));await new Promise(resolve=>setTimeout(resolve,10))});
  let rendered=JSON.stringify(visitor.toJSON());assert.match(rendered,/A complete description of this real role/);assert.match(rendered,/Relevant experience/);
  assert.doesNotMatch(rendered,/myjobscotland|source_url|Data reuse information|original listing|Super-admin|add or update full description/i);
  assert.equal(visitor.root.findAllByType('textarea').length,0);assert.equal(visitor.root.findAllByType('form').length,0);
  await act(async()=>visitor.update(React.createElement(JobDetails,{id:'one',title:'Teacher',isAdmin:false,onClose(){}})));
  assert.equal(visitor.root.findAllByType('textarea').length,0);
  await act(async()=>visitor.unmount());
  let admin;await act(async()=>{admin=create(React.createElement(JobDetails,{id:'one',title:'Teacher',isAdmin:true,onClose(){}}));await new Promise(resolve=>setTimeout(resolve,10))});
  rendered=JSON.stringify(admin.toJSON());assert.match(rendered,/Super-admin: add or update full description/);assert.doesNotMatch(rendered,/myjobscotland|Data reuse information|original listing/i);
  assert.equal(admin.root.findByType('textarea').props.value,fullDescription);
  const revised='A new, complete and current description for this job.';
  await act(async()=>{admin.root.findByType('textarea').props.onChange({target:{value:revised}});admin.root.findByType('input').props.onChange({target:{checked:true}})});
  await act(async()=>{await admin.root.findByType('form').props.onSubmit({preventDefault(){}});});
  assert.deepEqual(calls.find(c=>c.name==='admin_save_job_full_description').args,{p_job_id:'one',p_description:revised,p_confirm:true});
  assert.match(JSON.stringify(admin.toJSON()),/Full description saved/);assert.match(JSON.stringify(admin.toJSON()),/A new, complete and current description/);
  assert.equal(calls.filter(c=>c.name==='public_job_detail').length,3);
  await act(async()=>admin.update(React.createElement(JobDetails,{id:'one',title:'Teacher',isAdmin:false,onClose(){}})));
  assert.equal(admin.root.findAllByType('textarea').length,0);
  await act(async()=>admin.unmount());
 }finally{globalThis.document=previousDocument;delete globalThis.__detailsClient;await rm(dir,{recursive:true,force:true})}
});
