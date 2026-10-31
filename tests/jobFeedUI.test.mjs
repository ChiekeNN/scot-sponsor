import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';

test('on-platform listings use public opaque ids and contain no external application links',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'job-feed-test-'));
 try{
  let calls=[];globalThis.__jobFeedClient={rpc:async(name,params)=>{calls.push([name,params]);return {data:params.p_offset===0?[{id:'opaque-job',title:'Engineer',description:'Sponsorship not verified. A role in Scotland',employer:'Employer',location:'Glasgow',posted_at:'2026-10-30T12:00:00Z'}]:[],error:null}}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__jobFeedClient;');await writeFile(join(dir,'ApplicationSupport.mjs'),'import React from "react";export const ApplicationSupport=({jobId})=>React.createElement("span",null,"Support for "+jobId);');
  const source=await readFile('src/PartnerJobs.tsx','utf8');const compiled=await transformWithEsbuild(source,'src/PartnerJobs.tsx',{jsx:'automatic'});const path=join(dir,'jobs.mjs');await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"').replace('"./ApplicationSupport"','"./ApplicationSupport.mjs"'));
  const {PartnerJobs}=await import(pathToFileURL(path).href);let view;await act(async()=>{view=create(React.createElement(PartnerJobs,{isAdmin:false,email:'member@example.test',onAccount(){}}))});
  const text=JSON.stringify(view.toJSON());assert.match(text,/Engineer/);assert.match(text,/View job details/);assert.match(text,/Support for opaque-job/);assert.doesNotMatch(text,/adzuna|reed|View source|sponsorship\s+(?:is\s+)?not\s+verified/i);assert.match(text,/Please confirm sponsorship arrangements with the employer/);assert.equal(view.root.findAllByType('a').length,0);assert.equal(calls.length,2);assert.equal(calls[1][1].p_offset,1000);view.unmount();
 }finally{delete globalThis.__jobFeedClient;await rm(dir,{recursive:true,force:true})}
});
