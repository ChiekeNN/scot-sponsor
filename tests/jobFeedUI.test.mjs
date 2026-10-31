import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const ids=['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003'];
const rows=[{id:ids[0],title:'Civil Engineer',employer:'Employer',location:'Glasgow, Scotland',description:'Engineering role',posted_at:'2026-10-30T12:00:00Z'},{id:ids[1],title:'IT Support Analyst',employer:'Employer',location:'Edinburgh, Scotland',description:'Support role',posted_at:'2026-10-30T12:00:00Z'},{id:ids[2],title:'Care Assistant',employer:'Employer',location:'Dundee, Scotland',description:'No experience required.',posted_at:'2026-10-30T12:00:00Z'}];

test('Scottish feed uses server-side filters and paging, keeps details on-platform, and handles saved jobs',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'uk-job-feed-'));
 try{
  const calls=[];globalThis.__jobFeedClient={rpc:async(name,p)=>{calls.push({name,p});assert.equal(name,'public_job_search');let results=rows.filter(r=>(p.p_saved_ids===null||p.p_saved_ids.includes(r.id))&&(!p.p_query||`${r.title} ${r.employer} ${r.location}`.toLowerCase().includes(p.p_query.toLowerCase()))&&(!p.p_location||r.location.toLowerCase().includes(p.p_location.toLowerCase()))&&(!p.p_kind||p.p_terms.some(t=>(p.p_kind==='location'?r.location:p.p_include_excerpt?`${r.title} ${r.description}`:r.title).toLowerCase().includes(t.toLowerCase()))));return {data:results.slice(p.p_offset,p.p_offset+p.p_limit).map(r=>({...r,total:results.length})),error:null}}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__jobFeedClient;');await writeFile(join(dir,'JobDetails.mjs'),'import React from "react";export const JobDetails=({id})=>React.createElement("span",null,"Details for "+id);');
  const source=await readFile('src/PartnerJobs.tsx','utf8');const compiled=await transformWithEsbuild(source,'src/PartnerJobs.tsx',{jsx:'automatic'});const path=join(dir,'jobs.mjs');await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"').replace('"./JobDetails"','"./JobDetails.mjs"').replace('"./jobBrowse.mjs"',JSON.stringify(pathToFileURL(join(process.cwd(),'src/jobBrowse.mjs')).href)));
  const {PartnerJobs}=await import(pathToFileURL(path).href);let view;await act(async()=>{view=create(React.createElement(PartnerJobs));await wait(20)});
  let text=JSON.stringify(view.toJSON());assert.match(text,/Only available jobs with complete descriptions are shown/);
  await act(async()=>{view.update(React.createElement(PartnerJobs,{showNotice:false}));await wait(20)});text=JSON.stringify(view.toJSON());assert.doesNotMatch(text,/Only available jobs with complete descriptions are shown/);assert.match(text,/Civil Engineer/);assert.match(text,/IT Support Analyst/);assert.match(text,/Care Assistant/);assert.doesNotMatch(text,/adzuna|reed|View source|sponsorship\s+(?:is\s+)?not\s+verified/i);assert.equal(view.root.findAllByType('a').length,0);
  await act(async()=>{view.root.findAllByType('button').find(b=>b.children.includes('View job details')).props.onClick()});assert.match(JSON.stringify(view.toJSON()),new RegExp('Details for '+ids[0]));
  await act(async()=>{view.root.findAllByType('input').find(i=>i.props.placeholder==='Town, city or region').props.onChange({target:{value:'Edinburgh'}});await wait(300)});text=JSON.stringify(view.toJSON());assert.match(text,/IT Support Analyst/);assert.doesNotMatch(text,/Care Assistant|Civil Engineer/);assert.equal(calls.at(-1).p.p_location,'Edinburgh');
  let toggled='';await act(async()=>{view.update(React.createElement(PartnerJobs,{savedOnly:true,savedIds:[ids[1]],onToggleSaved:id=>toggled=id}));await wait(40)});text=JSON.stringify(view.toJSON());assert.match(text,/IT Support Analyst/);assert.doesNotMatch(text,/Care Assistant|Civil Engineer/);await act(async()=>view.root.findAllByType('button').find(b=>b.props['aria-label']==='Remove IT Support Analyst from saved jobs').props.onClick());assert.equal(toggled,ids[1]);
  let cleared=0;await act(async()=>{view.update(React.createElement(PartnerJobs,{browseSelection:{kind:'location',id:'dundee'},onClearBrowse(){cleared++}}));await wait(40)});text=JSON.stringify(view.toJSON());assert.match(text,/Care Assistant/);assert.doesNotMatch(text,/Civil Engineer|IT Support Analyst/);assert.equal(calls.at(-1).p.p_kind,'location');await act(async()=>view.root.findAllByType('button').find(b=>b.children.includes('Clear browse filter')).props.onClick());assert.equal(cleared,1);await act(async()=>view.unmount());
 }finally{delete globalThis.__jobFeedClient;await rm(dir,{recursive:true,force:true})}
});

test('server-side search retains complete-only protections',async()=>{const sql=await readFile('supabase/migrations/20261101030000_uk_job_search.sql','utf8');assert.match(sql,/join public\.job_complete_descriptions/);assert.match(sql,/listing_fingerprint=public\.job_listing_fingerprint/);assert.match(sql,/d\.updated_at>=now\(\)-interval '7 days'/);assert.match(sql,/p_location/);assert.match(sql,/count\(\*\) over\(\)/);assert.match(sql,/grant execute .* to anon, authenticated/i)});
