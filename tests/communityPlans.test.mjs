import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {pathToFileURL} from 'node:url';
import React from 'react';import {create,act} from 'react-test-renderer';import {transformWithEsbuild} from 'vite';

test('plan community switches only among active plans and keeps older mixed discussions admin-only',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'forum-plans-'));const oldW=globalThis.window,oldD=globalThis.document;let view,allowed=['monthly_alert_pass'],calls=[];
 try{
  globalThis.window={setInterval,clearInterval,addEventListener(){},removeEventListener(){},confirm:()=>true,prompt:()=>null};globalThis.document={getElementById:()=>null};
  globalThis.__plansClient={rpc:async(name,args)=>{calls.push({name,args});if(name==='forum_available_plans')return {data:allowed.map(plan=>({plan})),error:null};if(name==='forum_plan_threads_list')return {data:[{id:args.p_plan,title:`${args.p_plan} question`,body:'A helpful question details',created_at:'2026-10-31T12:00:00Z',own:false,replies:0}],error:null};return {data:[],error:null}}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__plansClient;');const code=await transformWithEsbuild(await readFile('src/CommunityForum.tsx','utf8'),'src/CommunityForum.tsx',{jsx:'automatic'});const path=join(dir,'CommunityForum.mjs');await writeFile(path,code.code.replace('"./directoryClient"','"./directoryClient.mjs"'));const {CommunityForum}=await import(pathToFileURL(path).href);
  const button=t=>view.root.findAllByType('button').find(b=>b.children.includes(t));
  await act(async()=>{view=create(React.createElement(CommunityForum,{isAdmin:false}))});
  assert.ok(button('Monthly Alert Pass'));assert.equal(button('Job Hunt Pass'),undefined);assert.equal(button('Earlier mixed discussions'),undefined);
  assert.match(JSON.stringify(view.toJSON()),/monthly_alert_pass question/);assert.equal(calls.find(c=>c.name==='forum_plan_threads_list').args.p_plan,'monthly_alert_pass');await act(async()=>view.root.findByType('input').props.onChange({target:{value:'A question title'}}));await act(async()=>view.root.findByType('textarea').props.onChange({target:{value:'A detailed question for members.'}}));await act(async()=>view.root.findByType('form').props.onSubmit({preventDefault(){}}));assert.equal(calls.find(c=>c.name==='forum_plan_create_thread').args.p_plan,'monthly_alert_pass');await act(async()=>view.unmount());view=null;
  allowed=['monthly_alert_pass','job_hunt_pass'];await act(async()=>{view=create(React.createElement(CommunityForum,{isAdmin:false}))});await act(async()=>button('Job Hunt Pass').props.onClick());assert.match(JSON.stringify(view.toJSON()),/job_hunt_pass question/);assert.doesNotMatch(JSON.stringify(view.toJSON()),/monthly_alert_pass question/);assert.ok(calls.some(c=>c.name==='forum_plan_threads_list'&&c.args.p_plan==='job_hunt_pass'));assert.equal(button('Earlier mixed discussions'),undefined);await act(async()=>view.unmount());view=null;
  await act(async()=>{view=create(React.createElement(CommunityForum,{isAdmin:true}))});await act(async()=>button('Earlier mixed discussions').props.onClick());assert.match(JSON.stringify(view.toJSON()),/admin-only archive/);assert.equal(view.root.findAllByType('form').length,0);assert.ok(calls.some(c=>c.name==='forum_plan_threads_list'&&c.args.p_plan==='archive'));
 }finally{if(view)await act(async()=>view.unmount());delete globalThis.__plansClient;if(oldW===undefined)delete globalThis.window;else globalThis.window=oldW;if(oldD===undefined)delete globalThis.document;else globalThis.document=oldD;await rm(dir,{recursive:true,force:true})}
});

test('database rejects unsegmented and cross-plan access for every content operation',async()=>{
 const sql=await readFile('supabase/migrations/20261101150000_plan_community_spaces.sql','utf8');
 assert.match(sql,/revoke all on function public\.forum_threads_list\(integer\),public\.forum_create_thread\(text,text\) from public,anon,authenticated/);
 assert.match(sql,/e\.plan=t\.plan and e\.starts_at<=now\(\) and e\.expires_at>now\(\) and e\.revoked_at is null/);
 for(const name of ['forum_replies_list','forum_create_reply','forum_delete','forum_report']){const section=sql.split(`function public.${name}(`)[1].split('end $$;')[0];assert.match(section,/forum_can_view_thread/)}
 assert.match(sql,/p_plan='archive'[\s\S]*not public\.is_super_admin/);assert.match(sql,/where \(p_plan='archive' and t\.plan is null\) or t\.plan=p_plan/);assert.match(sql,/perform public\.forum_require_access\(\)/);
});
