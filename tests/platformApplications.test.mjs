import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';

const content=node=>typeof node==='string'?node:(node.children||[]).map(content).join(' ');
const button=(view,label)=>view.root.findAllByType('button').find(x=>content(x).includes(label));
test('visitors see the Apply button and sign-in gate; members can submit a CV without a false employer confirmation',async()=>{
 const base=join(process.cwd(),'node_modules','.cache');await mkdir(base,{recursive:true});const dir=await mkdtemp(join(base,'apply-'));const previous=globalThis.document;const calls=[];let signedIn=false;
 try{
  globalThis.document={activeElement:null,body:{style:{overflow:''}},addEventListener(){},removeEventListener(){}};
  globalThis.__applyClient={rpc:async(name,args)=>{calls.push({name,args});if(name==='submit_platform_application')return {data:'application-id',error:null};return {data:{id:'job-one',title:'Teacher',employer:'Council',location:'Inverness',posted_at:'2026-10-31T00:00:00Z',expires_at:null,salary_min:null,salary_max:null,salary_is_predicted:null,salary_period:null,contract_type:null,contract_time:null,full_description:'A complete description of this job.'},error:null};}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__applyClient;');
  const source=await readFile('src/JobDetails.tsx','utf8');const compiled=await transformWithEsbuild(source,'src/JobDetails.tsx',{jsx:'automatic'});const path=join(dir,'JobDetails.mjs');
  await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"').replace('"./jobDescription.mjs"',JSON.stringify(pathToFileURL(join(process.cwd(),'src/jobDescription.mjs')).href)));
  const {JobDetails}=await import(pathToFileURL(path).href);let view;
  await act(async()=>{view=create(React.createElement(JobDetails,{id:'job-one',title:'Teacher',onClose(){},onSignIn(){signedIn=true}}));});
  await act(async()=>button(view,'Apply for this job').props.onClick());assert.match(JSON.stringify(view.toJSON()),/Sign in or create a free account/);assert.equal(view.root.findAllByType('form').length,0);
  await act(async()=>button(view,'Sign in or create account').props.onClick());assert.equal(signedIn,true);
  await act(async()=>view.update(React.createElement(JobDetails,{id:'job-one',title:'Teacher',loggedIn:true,onClose(){}})));
  assert.match(JSON.stringify(view.toJSON()),/not currently sent to the employer or by email/);
  const input=view.root.findAllByType('input');await act(async()=>{input.find(x=>x.props.autoComplete==='name').props.onChange({target:{value:'Test Applicant'}});input.find(x=>x.props.type==='file').props.onChange({target:{files:[{name:'cv.pdf',size:12,arrayBuffer:async()=>new TextEncoder().encode('%PDF-example').buffer}]}});input.find(x=>x.props.type==='checkbox').props.onChange({target:{checked:true}})});
  await act(async()=>{await view.root.findByType('form').props.onSubmit({preventDefault(){}})});
  const submission=calls.find(x=>x.name==='submit_platform_application');assert.equal(submission.args.p_job_id,'job-one');assert.equal(submission.args.p_cv_name,'cv.pdf');assert.equal(submission.args.p_cv_base64,Buffer.from('%PDF-example').toString('base64'));assert.equal(submission.args.p_consent,true);
  assert.match(JSON.stringify(view.toJSON()),/submitted to ScotSponsor/);assert.match(JSON.stringify(view.toJSON()),/not been sent to the employer/);
  await act(async()=>view.unmount());
 }finally{globalThis.document=previous;delete globalThis.__applyClient;await rm(dir,{recursive:true,force:true})}
});

test('admin list can edit, suspend, reactivate and delete applications',async()=>{
 const base=join(process.cwd(),'node_modules','.cache');await mkdir(base,{recursive:true});const dir=await mkdtemp(join(base,'admin-app-'));const oldWindow=globalThis.window;const calls=[];
 const item={id:'app-one',job_title:'Teacher',employer:'Council',location:'Inverness',applicant_name:'Alex',applicant_email:'alex@example.test',cover_note:'Experience',cv_name:'cv.pdf',status:'active',created_at:'2026-10-31T00:00:00Z',total:1};
 try{
  globalThis.window={confirm:()=>true};globalThis.__adminAppClient={rpc:async(name,args)=>{calls.push({name,args});if(name==='admin_platform_applications')return {data:[item],error:null};if(name==='admin_update_platform_application')Object.assign(item,{applicant_name:args.p_name,applicant_email:args.p_email,cover_note:args.p_note,status:args.p_status});return {data:null,error:null}}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__adminAppClient;');const source=await readFile('src/AdminJobApplications.tsx','utf8');const compiled=await transformWithEsbuild(source,'src/AdminJobApplications.tsx',{jsx:'automatic'});const path=join(dir,'AdminJobApplications.mjs');await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"'));const {AdminJobApplications}=await import(pathToFileURL(path).href);
  let view;await act(async()=>{view=create(React.createElement(AdminJobApplications));});assert.match(JSON.stringify(view.toJSON()),/Alex/);assert.match(JSON.stringify(view.toJSON()),/Download CV/);
  await act(async()=>button(view,'Edit').props.onClick());await act(async()=>view.root.findAllByType('input')[0].props.onChange({target:{value:'Alex Updated'}}));await act(async()=>{view.root.findByType('form').props.onSubmit({preventDefault(){}});await new Promise(r=>setTimeout(r,0))});assert.equal(calls.find(x=>x.name==='admin_update_platform_application').args.p_name,'Alex Updated');
  await act(async()=>{button(view,'Suspend').props.onClick();await new Promise(r=>setTimeout(r,0))});assert.equal(item.status,'suspended');
  await act(async()=>{button(view,'Reactivate').props.onClick();await new Promise(r=>setTimeout(r,0))});assert.equal(item.status,'active');
  await act(async()=>{button(view,'Delete').props.onClick();await new Promise(r=>setTimeout(r,0))});assert.equal(calls.filter(x=>x.name==='admin_delete_platform_application')[0].args.p_id,'app-one');await act(async()=>view.unmount());
 }finally{globalThis.window=oldWindow;delete globalThis.__adminAppClient;await rm(dir,{recursive:true,force:true})}
});

test('applications and CVs stay private while listings are also shown publicly',async()=>{
 const sql=await readFile('supabase/migrations/20261101073000_platform_job_applications.sql','utf8');
 assert.match(sql,/revoke all on public\.platform_job_applications from public, anon, authenticated/i);assert.match(sql,/if not public\.is_super_admin\(\) then raise exception 'NOT_AUTHORISED'/i);assert.match(sql,/public\.public_job_detail\(p_job_id\) is null/i);assert.match(sql,/octet_length\(contents\) not between 5 and 2097152/i);assert.match(sql,/delete from public\.platform_job_applications where id=p_id/i);assert.match(sql,/revoke all on function public\.submit_platform_application[^;]+from public, anon/i);
 const landing=await readFile('src/Landing.tsx','utf8');const app=await readFile('src/App.tsx','utf8');const account=await readFile('src/AccountCenter.tsx','utf8');assert.match(landing,/\{jobFeed\}/);assert.match(app,/showLanding && <PublicLanding jobFeed=\{<PartnerJobs/);assert.match(account,/screen === 'admin' && isAdmin \? <><AdminJobApplications/);
});
