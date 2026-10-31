import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';

test('job details show the full description without source controls for visitors or admins',async()=>{
 const dir=await mkdtemp(join(await mkdir(join(process.cwd(),'node_modules','.cache'),{recursive:true}).then(()=>join(process.cwd(),'node_modules','.cache')),'job-details-'));
 const previousDocument=globalThis.document;
 const calls=[];
 try{
  globalThis.document={activeElement:null,body:{style:{overflow:''}},addEventListener(){},removeEventListener(){}};
  globalThis.__detailsClient={rpc:async(name)=>{calls.push(name);return {data:{id:'one',title:'Teacher',employer:'Council',location:'Inverness',posted_at:'2026-10-31T00:00:00Z',expires_at:null,salary_min:null,salary_max:null,salary_is_predicted:null,salary_period:null,contract_type:null,contract_time:null,source_url:'https://myjobscotland.gov.uk/example',full_description:'Summary\nA complete description of this real role.\n\nRequirements\n- Relevant experience.'},error:null}}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__detailsClient;');
  const source=await readFile('src/JobDetails.tsx','utf8');const compiled=await transformWithEsbuild(source,'src/JobDetails.tsx',{jsx:'automatic'});const path=join(dir,'JobDetails.mjs');
  await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"').replace('"./jobDescription.mjs"',JSON.stringify(pathToFileURL(join(process.cwd(),'src/jobDescription.mjs')).href)));
  const {JobDetails}=await import(pathToFileURL(path).href);
  for(const isAdmin of [false,true]){
   let view;await act(async()=>{view=create(React.createElement(JobDetails,{id:'one',title:'Teacher',isAdmin,onClose(){}}));await new Promise(resolve=>setTimeout(resolve,10))});
   const rendered=JSON.stringify(view.toJSON());assert.match(rendered,/A complete description of this real role/);assert.match(rendered,/Relevant experience/);
   assert.doesNotMatch(rendered,/myjobscotland|source_url|Data reuse information|original listing|Super-admin|add or update full description/i);
   assert.equal(view.root.findAllByType('a').length,0);assert.equal(view.root.findAllByType('textarea').length,0);
   await act(async()=>view.unmount());
  }
  assert.deepEqual(calls,['public_job_detail','public_job_detail']);
 }finally{globalThis.document=previousDocument;delete globalThis.__detailsClient;await rm(dir,{recursive:true,force:true})}
});
