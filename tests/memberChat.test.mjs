import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';
const text=n=>typeof n==='string'?n:(n.children||[]).map(text).join(' ');
const findButton=(v,t)=>v.root.findAllByType('button').find(x=>text(x).includes(t));
const wait=()=>new Promise(r=>setTimeout(r,10));

test('member chat signs in, sends text and documents, reacts, edits and deletes',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'chat-test-'));const oldWindow=globalThis.window;const calls=[];let signIn=false;
 let messages=[{id:'message-a',sender_id:'member',body:'Hello there',created_at:'2026-10-31T12:00:00Z',edited_at:null,deleted_at:null,attachment_name:null,reactions:[]}];
 try{
  globalThis.window={setInterval,clearInterval,setTimeout,clearTimeout,confirm:()=>true};
  globalThis.__chatClient={rpc:async(name,args)=>{calls.push({name,args});if(name==='chat_start')return {data:'thread-a',error:null};if(name==='chat_inbox')return {data:[{id:'thread-a',member_id:'member',member_email:null,last_message_at:null,unread:false}],error:null};if(name==='chat_messages_page')return {data:messages,error:null};if(name==='chat_edit')messages=messages.map(m=>m.id===args.p_message?{...m,body:args.p_body,edited_at:'2026-10-31T13:00:00Z'}:m);if(name==='chat_delete')messages=messages.map(m=>m.id===args.p_message?{...m,body:'',deleted_at:'2026-10-31T13:00:00Z',attachment_name:null}:m);if(name==='chat_react')messages=messages.map(m=>m.id===args.p_message?{...m,reactions:[{emoji:args.p_emoji,count:1,mine:true}]}:m);return {data:null,error:null}}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__chatClient;');const src=await readFile('src/MemberChat.tsx','utf8');const compiled=await transformWithEsbuild(src,'src/MemberChat.tsx',{jsx:'automatic'});const path=join(dir,'MemberChat.mjs');await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"'));const {MemberChat}=await import(pathToFileURL(path).href);
  let guest;await act(async()=>{guest=create(React.createElement(MemberChat,{session:null,isAdmin:false,onSignIn(){signIn=true}}))});assert.match(JSON.stringify(guest.toJSON()),/text and documents only/i);await act(async()=>findButton(guest,'Sign in').props.onClick());assert.equal(signIn,true);await act(async()=>guest.unmount());
  let view;await act(async()=>{view=create(React.createElement(MemberChat,{session:{user:{id:'member'}},isAdmin:false,onSignIn(){}}));await wait()});assert.match(JSON.stringify(view.toJSON()),/Hello there/);assert.match(JSON.stringify(view.toJSON()),/No voice or video/);
  await act(async()=>findButton(view,'Edit').props.onClick());const edit=view.root.findAllByType('textarea').find(x=>x.props['aria-label']==='Edit message');await act(async()=>edit.props.onChange({target:{value:'Edited message'}}));await act(async()=>{view.root.findAllByType('form')[0].props.onSubmit({preventDefault(){}});await wait()});assert.equal(calls.find(x=>x.name==='chat_edit').args.p_body,'Edited message');assert.match(JSON.stringify(view.toJSON()),/Edited message/);
  const react=view.root.findAllByType('button').find(x=>x.props['aria-label']?.startsWith('React 👍'));await act(async()=>{react.props.onClick();await wait()});assert.equal(calls.find(x=>x.name==='chat_react').args.p_emoji,'👍');
  await act(async()=>{findButton(view,'Delete').props.onClick();await wait()});assert.equal(calls.find(x=>x.name==='chat_delete').args.p_message,'message-a');assert.match(JSON.stringify(view.toJSON()),/Message deleted/);
  const compose=view.root.findAllByType('textarea').find(x=>x.props['aria-label']==='Write a message');const upload=view.root.findByProps({type:'file'});await act(async()=>{compose.props.onChange({target:{value:'Please see my CV'}});upload.props.onChange({target:{files:[{name:'cv.pdf',size:9,arrayBuffer:async()=>new TextEncoder().encode('%PDF-test').buffer}]}})});
  await act(async()=>{view.root.findByType('form').props.onSubmit({preventDefault(){}});await wait()});const sent=calls.find(x=>x.name==='chat_send');assert.equal(sent.args.p_thread,'thread-a');assert.equal(sent.args.p_body,'Please see my CV');assert.equal(sent.args.p_name,'cv.pdf');assert.equal(sent.args.p_base64,Buffer.from('%PDF-test').toString('base64'));
  await act(async()=>view.unmount());
 }finally{globalThis.window=oldWindow;delete globalThis.__chatClient;await rm(dir,{recursive:true,force:true})}
});

test('chat database makes all content private and checks participants for every operation',async()=>{
 const sql=await readFile('supabase/migrations/20261101075000_private_member_chat.sql','utf8');
 for(const name of ['chat_threads','chat_messages','chat_attachments','chat_reactions'])assert.match(sql,new RegExp(`alter table public\\.${name} enable row level security`));
 assert.match(sql,/revoke all on public\.chat_threads,public\.chat_messages,public\.chat_attachments,public\.chat_reactions from public,anon,authenticated/);
 for(const name of ['chat_messages_page','chat_send','chat_edit','chat_delete','chat_react','chat_download','chat_mark_read']){const section=sql.split(`create function public.${name}(`)[1].split('end $$;')[0];assert.match(section,/public\.chat_can_access/);}
 assert.match(sql,/m\.sender_id is distinct from auth\.uid\(\)/);assert.match(sql,/delete from public\.chat_attachments where message_id=m.id/);assert.match(sql,/octet_length\(bytes\) not between 1 and 2097152/);assert.match(sql,/email_confirmed_at is not null/);assert.doesNotMatch(sql,/voice|video/i);
});

test('super-admin can find a verified account and open its private conversation',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'chat-admin-'));const oldWindow=globalThis.window;const calls=[];
 try{
  globalThis.window={setInterval,clearInterval,setTimeout,clearTimeout,confirm:()=>true};globalThis.__chatAdminClient={rpc:async(name,args)=>{calls.push({name,args});if(name==='chat_admin_users')return {data:[{id:'member-one',email:'member@example.test'}],error:null};if(name==='chat_start')return {data:'thread-one',error:null};if(name==='chat_inbox')return {data:[{id:'thread-one',member_id:'member-one',member_email:'member@example.test',last_message_at:null,unread:false}],error:null};if(name==='chat_messages_page')return {data:[{id:'msg',sender_id:'member-one',body:'Hello admin',created_at:'2026-10-31T12:00:00Z',edited_at:null,deleted_at:null,attachment_name:null,reactions:[]}],error:null};return {data:null,error:null}}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__chatAdminClient;');const src=await readFile('src/MemberChat.tsx','utf8');const compiled=await transformWithEsbuild(src,'src/MemberChat.tsx',{jsx:'automatic'});const path=join(dir,'MemberChat.mjs');await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"'));const {MemberChat}=await import(pathToFileURL(path).href);
  let view;await act(async()=>{view=create(React.createElement(MemberChat,{session:{user:{id:'admin'}},isAdmin:true,onSignIn(){}}));await wait()});assert.equal(calls.some(c=>c.name==='chat_start'),false);
  await act(async()=>{view.root.findByProps({type:'search'}).props.onChange({target:{value:'member'}});await new Promise(r=>setTimeout(r,350))});assert.match(JSON.stringify(view.toJSON()),/member@example.test/);
  await act(async()=>{findButton(view,'Start chat').props.onClick();await wait()});assert.equal(calls.find(c=>c.name==='chat_start').args.p_member,'member-one');assert.match(JSON.stringify(view.toJSON()),/Hello admin/);
  await act(async()=>view.unmount());
 }finally{globalThis.window=oldWindow;delete globalThis.__chatAdminClient;await rm(dir,{recursive:true,force:true})}
});
