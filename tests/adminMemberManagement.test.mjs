import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';import {join} from 'node:path';import {pathToFileURL} from 'node:url';import React from 'react';import {create,act} from 'react-test-renderer';import {transformWithEsbuild} from 'vite';
const txt=n=>typeof n==='string'?n:(n.children||[]).map(txt).join(' ');
test('individual member view supports profile, plan and account management',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'admin-member-ui-'));const oldW=globalThis.window;let view;const calls=[];
 try{
  let confirmEmail='member@example.test';globalThis.window={confirm:()=>true,prompt:()=>confirmEmail};
  const member={user_id:'member',email:'member@example.test',full_name:'Jane Member',first_name:'Jane',last_name:'Member',phone:'+44 1234567890',email_confirmed:true,created_at:'2026-01-01T00:00:00Z',member_number:'SS-123',demo_plan:null,is_admin:false,suspended:false,auth_banned:false,passes:[{plan:'monthly_alert_pass',starts_at:'2020-01-01T00:00:00Z',expires_at:'2099-01-01T00:00:00Z',revoked_at:null}],total:2};
  const admin={...member,user_id:'admin',email:'admin@example.test',full_name:'Admin',first_name:'Admin',is_admin:true};
  globalThis.__memberClient={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='admin_member_directory_v2'?[admin,member]:name==='admin_member_detail'?(args.p_user==='admin'?admin:member):null,error:null}},functions:{invoke:async(name,args)=>{calls.push({name,args});return {data:{status:args.body.action==='delete'?'deleted':args.body.action==='suspend'?'suspended':'restored'},error:null}}}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__memberClient;');const compiled=await transformWithEsbuild(await readFile('src/AdminMembers.tsx','utf8'),'src/AdminMembers.tsx',{jsx:'automatic'});const path=join(dir,'AdminMembers.mjs');await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"'));const {AdminMembers}=await import(pathToFileURL(path).href);
  const find=(node,name)=>node.findAllByType('button').find(b=>txt(b).includes(name));
  await act(async()=>{view=create(React.createElement(AdminMembers))});let articles=view.root.findAllByType('article');assert.equal(articles.length,2);assert.match(txt(articles[1]),/Jane.*Member.*member@example.test.*1234567890/);
  await act(async()=>view.root.findAllByType('select')[0].props.onChange({target:{value:'job_hunt_pass'}}));assert.ok(calls.some(c=>c.name==='admin_member_directory_v2'&&c.args.p_filter==='job_hunt_pass'));
  await act(async()=>find(view.root.findAllByType('article')[0],'View member').props.onClick());assert.ok(calls.some(c=>c.name==='admin_member_detail'&&c.args.p_user==='admin'));assert.equal(find(view.root,'Edit member details'),undefined);await act(async()=>find(view.root,'Back to members').props.onClick());
  await act(async()=>find(view.root.findAllByType('article')[1],'View member').props.onClick());assert.ok(calls.some(c=>c.name==='admin_member_detail'&&c.args.p_user==='member'));assert.match(txt(view.root),/Not SMS-verified/);
  await act(async()=>find(view.root,'Edit member details').props.onClick());const inputs=view.root.findAllByType('input');await act(async()=>inputs.find(i=>i.props.value==='Jane').props.onChange({target:{value:'Janet'}}));const form=view.root.findAllByType('form').find(f=>find(f,'Save details'));await act(async()=>form.props.onSubmit({preventDefault(){}}));assert.ok(calls.some(c=>c.name==='admin_edit_member_profile'&&c.args.p_first_name==='Janet'&&c.args.p_phone===member.phone));
  await act(async()=>find(view.root,'Change plan').props.onClick());assert.ok(calls.some(c=>c.name==='admin_change_member_plan'&&c.args.p_from==='monthly_alert_pass'&&c.args.p_to==='job_hunt_pass'));
  member.passes=[{...member.passes[0],plan:'job_hunt_pass'}];await act(async()=>find(view.root,'Refresh').props.onClick());await act(async()=>find(view.root,'Change plan').props.onClick());assert.ok(calls.some(c=>c.name==='admin_change_member_plan'&&c.args.p_from==='job_hunt_pass'&&c.args.p_to==='monthly_alert_pass'));
  await act(async()=>find(view.root,'Grant or update pass').props.onClick());assert.ok(calls.some(c=>c.name==='admin_set_pass'&&c.args.p_action==='grant'));
  await act(async()=>find(view.root,'Suspend').props.onClick());assert.ok(calls.some(c=>c.name==='admin-member-account'&&c.args.body.action==='suspend'));
  confirmEmail='wrong';await act(async()=>find(view.root,'Delete member').props.onClick());assert.equal(calls.filter(c=>c.name==='admin-member-account'&&c.args.body.action==='delete').length,0);confirmEmail=member.email;await act(async()=>find(view.root,'Delete member').props.onClick());assert.equal(calls.filter(c=>c.name==='admin-member-account'&&c.args.body.action==='delete').length,1);
 }finally{if(view)await act(async()=>view.unmount());delete globalThis.__memberClient;if(oldW===undefined)delete globalThis.window;else globalThis.window=oldW;await rm(dir,{recursive:true,force:true})}
});

test('member details and plan changes are protected and atomic',async()=>{
 const sql=await readFile('supabase/migrations/20261101170000_member_details_and_plan_changes.sql','utf8');assert.match(sql,/admin_member_target_allowed/);assert.match(sql,/not public\.is_super_admin\(\)/);assert.match(sql,/TARGET_PASS_ALREADY_ACTIVE/);assert.match(sql,/for update/);assert.match(sql,/revoke all on function public\.admin_member_directory_v2/);assert.match(sql,/contact_phone/);assert.match(sql,/admin_audit_log/);
});

test('member controls are admin-only and suspension protects member gates',async()=>{
 const sql=await readFile('supabase/migrations/20261101160000_admin_member_management.sql','utf8');const edge=await readFile('supabase/functions/admin-member-account/index.ts','utf8');
 assert.match(sql,/not public\.is_super_admin\(\)/);assert.match(sql,/not exists\(select 1 from public\.super_admins a where a.user_id=p_user\)/);assert.match(sql,/member_account_is_suspended\(auth.uid\(\)\)/);assert.match(sql,/suspended_application_guard/);assert.match(sql,/limit 25/);assert.match(sql,/no_active/);assert.match(sql,/member_admin_actions/);
 assert.match(edge,/caller\.auth\.getUser\(\)/);assert.match(edge,/admin_member_target_allowed/);assert.match(edge,/ban_duration:'876000h'/);assert.match(edge,/ban_duration:'none'/);assert.match(edge,/admin\.auth\.admin\.deleteUser/);assert.match(edge,/admin_member_record_delete/);
});

test('account edge checks caller and target and fails closed on partial suspension',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'member-edge-'));const old=globalThis.Deno;let handler,role=true,allowed=true,banError=false;const actions=[];
 try{
  globalThis.Deno={env:{get:key=>({SUPABASE_URL:'https://example.test',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service'})[key]},serve:fn=>{handler=fn}};
  globalThis.__memberEdgeCreate=(_url,key)=>key==='anon'?{auth:{getUser:async()=>({data:{user:{id:'admin',email_confirmed_at:'yes'}},error:null})},rpc:async(name,args)=>{actions.push({name,args});if(name==='is_super_admin')return {data:role,error:null};if(name==='admin_member_target_allowed')return {data:allowed,error:null};return {data:null,error:null}}}:{auth:{admin:{updateUserById:async(id,params)=>{actions.push({name:'auth_update',id,params});return {error:banError?Error('unavailable'):null}},deleteUser:async(id)=>{actions.push({name:'auth_delete',id});return {error:null}}}}};
  await writeFile(join(dir,'client.mjs'),'export const createClient=globalThis.__memberEdgeCreate;');const code=await transformWithEsbuild(await readFile('supabase/functions/admin-member-account/index.ts','utf8'),'index.ts');const path=join(dir,'index.mjs');await writeFile(path,code.code.replace('"npm:@supabase/supabase-js@2"','"./client.mjs"'));await import(pathToFileURL(path).href);
  const request=action=>new Request('https://example.test/',{method:'POST',headers:{Authorization:'Bearer token','Content-Type':'application/json'},body:JSON.stringify({user_id:'d41f7fb8-6daf-4a24-900a-060f29667aa9',action})});
  role=false;assert.equal((await handler(request('delete'))).status,403);assert.equal(actions.some(x=>x.name==='auth_delete'),false);
  role=true;allowed=false;assert.equal((await handler(request('suspend'))).status,403);assert.equal(actions.some(x=>x.name==='auth_update'),false);
  allowed=true;banError=true;actions.length=0;const failed=await handler(request('suspend'));assert.equal(failed.status,503);assert.equal((await failed.json()).access_suspended,true);assert.deepEqual(actions.slice(-2).map(x=>x.name),['admin_member_set_suspension','auth_update']);
  banError=false;actions.length=0;assert.equal((await handler(request('restore'))).status,200);assert.deepEqual(actions.slice(-2).map(x=>x.name),['auth_update','admin_member_set_suspension']);
  actions.length=0;assert.equal((await handler(request('delete'))).status,200);assert.deepEqual(actions.slice(-3).map(x=>x.name),['admin_member_record_delete','auth_delete','admin_member_record_delete']);
 }finally{if(old===undefined)delete globalThis.Deno;else globalThis.Deno=old;delete globalThis.__memberEdgeCreate;await rm(dir,{recursive:true,force:true})}
});
