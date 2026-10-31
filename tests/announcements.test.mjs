import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';import {create,act} from 'react-test-renderer';import {transformWithEsbuild} from 'vite';
const text=n=>typeof n==='string'?n:(n.children||[]).map(text).join(' ');
const button=(v,t)=>v.root.findAllByType('button').find(x=>text(x).includes(t));
const wait=()=>new Promise(r=>setTimeout(r,300));

test('announcements are published to all or selected members and member can mark them read',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'announcements-'));const oldWindow=globalThis.window;const calls=[];let view,read=false;
 try{
  globalThis.window={setInterval,clearInterval,setTimeout,clearTimeout,confirm:()=>true};
  globalThis.__announcementsClient={rpc:async(name,args)=>{calls.push({name,args});if(name==='announcement_list')return {data:[{id:'note',title:'An update',body:'Important update for you.',created_at:'2026-10-31T12:00:00Z',read_at:read?'2026-10-31T12:10:00Z':null,audience:'selected',recipient_count:1}],error:null};if(name==='chat_admin_members')return {data:[{id:'one',email:'one@example.test'},{id:'two',email:'two@example.test'}],error:null};if(name==='announcement_publish')return {data:args.p_audience==='all'?2:args.p_members.length,error:null};if(name==='announcement_mark_read')read=true;return {data:null,error:null}}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__announcementsClient;');const compiled=await transformWithEsbuild(await readFile('src/Announcements.tsx','utf8'),'src/Announcements.tsx',{jsx:'automatic'});const path=join(dir,'Announcements.mjs');await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"'));const {Announcements}=await import(pathToFileURL(path).href);
  await act(async()=>{view=create(React.createElement(Announcements,{isAdmin:true,onRead(){}}))});await act(async()=>button(view,'Create announcement').props.onClick());
  let inputs=view.root.findAllByType('input');await act(async()=>inputs.find(x=>x.props.minLength===3).props.onChange({target:{value:'Hello members'}}));await act(async()=>view.root.findByType('textarea').props.onChange({target:{value:'A useful update for our members.'}}));
  await act(async()=>view.root.findByType('form').props.onSubmit({preventDefault(){}}));let sent=calls.find(c=>c.name==='announcement_publish');assert.equal(sent.args.p_audience,'all');assert.equal(sent.args.p_members,null);assert.match(JSON.stringify(view.toJSON()),/posted to 2 members/);
  await act(async()=>button(view,'Create announcement').props.onClick());inputs=view.root.findAllByType('input');await act(async()=>inputs.find(x=>x.props.minLength===3).props.onChange({target:{value:'Private update'}}));await act(async()=>view.root.findByType('textarea').props.onChange({target:{value:'A selected members update.'}}));
  await act(async()=>{view.root.findAllByProps({type:'radio'})[1].props.onChange();await wait()});assert.equal(view.root.findAllByProps({type:'checkbox'}).length,2);
  await act(async()=>view.root.findAllByProps({type:'checkbox'})[1].props.onChange({target:{checked:true}}));await act(async()=>view.root.findByType('form').props.onSubmit({preventDefault(){}}));sent=calls.filter(c=>c.name==='announcement_publish')[1];assert.deepEqual(sent.args.p_members,['two']);assert.equal(sent.args.p_audience,'selected');await act(async()=>view.unmount());view=null;
  let updated=false;await act(async()=>{view=create(React.createElement(Announcements,{isAdmin:false,onRead(){updated=true}}))});assert.equal(button(view,'Create announcement'),undefined);await act(async()=>button(view,'Mark as read').props.onClick());assert.equal(updated,true);assert.equal(read,true);assert.equal(button(view,'Mark as read'),undefined);
 }finally{if(view)await act(async()=>view.unmount());if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;delete globalThis.__announcementsClient;await rm(dir,{recursive:true,force:true})}
});

test('server protects membership identities and snapshots announcement recipients',async()=>{
 const sql=await readFile('supabase/migrations/20261101140000_member_announcements.sql','utf8');
 assert.match(sql,/chat_admin_members[\s\S]*not public\.is_super_admin\(\)/);assert.match(sql,/e\.starts_at<=now\(\) and e\.expires_at>now\(\) and e\.revoked_at is null/);
 assert.match(sql,/revoke all on public\.member_announcements,public\.member_announcement_recipients from public,anon,authenticated/);
 assert.match(sql,/p_audience='selected' and count_members<>cardinality\(p_members\)/);assert.match(sql,/where public\.is_super_admin\(\) or r\.user_id is not null/);assert.match(sql,/user_id=auth\.uid\(\)/);assert.match(sql,/pg_advisory_xact_lock/);
});

test('body copy is larger and the navigation adapts to readable text',async()=>{
 const css=await readFile('src/index.css','utf8');
 assert.match(css,/\.public-hero-copy>p\{[^}]*font-size:(?:1[4-9]|[2-9]\d)px/);
 assert.match(css,/\.chat-heading p,\.chat-gate p\{[^}]*font-size:(?:1[4-9]|[2-9]\d)px/);
 assert.match(css,/\.hero\{height:auto;min-height:300px\}/);assert.match(css,/@media\(max-width:1400px\)\{\.public-header \.public-nav/);
});
