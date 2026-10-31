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
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__jobFeedClient;');await writeFile(join(dir,'JobDetails.mjs'),'import React from "react";export const JobDetails=({id})=>React.createElement("span",null,"Details for "+id);');
  const source=await readFile('src/PartnerJobs.tsx','utf8');const compiled=await transformWithEsbuild(source,'src/PartnerJobs.tsx',{jsx:'automatic'});const path=join(dir,'jobs.mjs');await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"').replace('"./JobDetails"','"./JobDetails.mjs"').replace('"./jobBrowse.mjs"',JSON.stringify(pathToFileURL(join(process.cwd(),'src/jobBrowse.mjs')).href)));
  const {PartnerJobs}=await import(pathToFileURL(path).href);let view;await act(async()=>{view=create(React.createElement(PartnerJobs,{isAdmin:false}))});
  const text=JSON.stringify(view.toJSON());assert.match(text,/Engineer/);assert.doesNotMatch(text,/personal application support|Requests go to ScotSponsor/i);assert.match(text,/View job details/);assert.match(text,/A role in Scotland/);assert.doesNotMatch(text,/adzuna|reed|View source|sponsorship\s+(?:is\s+)?not\s+verified/i);assert.match(text,/Please confirm sponsorship arrangements with the employer/);assert.equal(view.root.findAllByType('a').length,0);assert.equal(calls.length,2);assert.equal(calls[1][1].p_offset,1000);
  await act(async()=>{view.root.findAllByType('button').find(b=>b.children.includes('View job details')).props.onClick()});assert.match(JSON.stringify(view.toJSON()),/Details for opaque-job/);view.unmount();
 }finally{delete globalThis.__jobFeedClient;await rm(dir,{recursive:true,force:true})}
});

test('browse selection filters the live feed and can be cleared or changed',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'job-browse-feed-'));
 try{
  const rows=[{id:'1',title:'Civil Engineer',employer:'Employer',location:'Glasgow, Scotland',description:'Engineering role',posted_at:'2026-10-30T12:00:00Z'},{id:'2',title:'IT Support Analyst',employer:'Employer',location:'Edinburgh, Scotland',description:'Support role',posted_at:'2026-10-30T12:00:00Z'},{id:'3',title:'Care Assistant',employer:'Employer',location:'Glasgow, Scotland',description:'No experience required.',posted_at:'2026-10-30T12:00:00Z'}];
  globalThis.__jobFeedClient={rpc:async(name,params)=>({data:params.p_offset===0?rows:[],error:null})};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__jobFeedClient;');await writeFile(join(dir,'JobDetails.mjs'),'export const JobDetails=()=>null;');
  const source=await readFile('src/PartnerJobs.tsx','utf8');const compiled=await transformWithEsbuild(source,'src/PartnerJobs.tsx',{jsx:'automatic'});const path=join(dir,'jobs.mjs');await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"').replace('"./JobDetails"','"./JobDetails.mjs"').replace('"./jobBrowse.mjs"',JSON.stringify(pathToFileURL(join(process.cwd(),'src/jobBrowse.mjs')).href)));
  const {PartnerJobs}=await import(pathToFileURL(path).href);let cleared=0;const props={browseSelection:{kind:'industry',id:'engineering'},onClearBrowse(){cleared++}};let view;await act(async()=>{view=create(React.createElement(PartnerJobs,props))});
  let text=JSON.stringify(view.toJSON());assert.match(text,/Engineering Jobs/);assert.match(text,/Civil Engineer/);assert.doesNotMatch(text,/IT Support Analyst|Care Assistant/);
  await act(async()=>{view.update(React.createElement(PartnerJobs,{...props,browseSelection:{kind:'popular',id:'no-experience'}}))});text=JSON.stringify(view.toJSON());assert.match(text,/Care Assistant/);assert.doesNotMatch(text,/Civil Engineer|IT Support Analyst/);assert.match(text,/titles and excerpts/);
  await act(async()=>{view.update(React.createElement(PartnerJobs,{...props,browseSelection:{kind:'location',id:'edinburgh'}}))});text=JSON.stringify(view.toJSON());assert.match(text,/IT Support Analyst/);assert.doesNotMatch(text,/Civil Engineer|Care Assistant/);
  await act(async()=>{view.root.findAllByType('button').find(b=>b.children.includes('Clear browse filter')).props.onClick()});assert.equal(cleared,1);
  await act(async()=>{view.update(React.createElement(PartnerJobs,{...props,browseSelection:null}))});text=JSON.stringify(view.toJSON());assert.match(text,/Civil Engineer/);assert.match(text,/IT Support Analyst/);assert.match(text,/Care Assistant/);
  let toggled='';await act(async()=>{view.update(React.createElement(PartnerJobs,{savedOnly:true,savedIds:['2','expired'],onToggleSaved:id=>toggled=id}))});text=JSON.stringify(view.toJSON());assert.match(text,/IT Support Analyst/);assert.doesNotMatch(text,/Civil Engineer|Care Assistant/);assert.match(text,/Closed or unavailable jobs will not appear/);await act(async()=>{view.root.findAllByType('button').find(b=>b.props['aria-label']==='Remove IT Support Analyst from saved jobs').props.onClick()});assert.equal(toggled,'2');await act(async()=>view.unmount());
 }finally{delete globalThis.__jobFeedClient;await rm(dir,{recursive:true,force:true})}
});
