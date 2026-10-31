import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';

test('super admin can identify, ban, remove and restore members; ordinary members cannot see controls',async()=>{
 const oldWindow=globalThis.window,oldDocument=globalThis.document;
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'forum-ui-'));
 let view;
 try{
  globalThis.window={setInterval,clearInterval,confirm:()=>true,prompt:()=>null};globalThis.document={getElementById:()=>({scrollIntoView(){}})};
  const calls=[];let status='active';
  globalThis.__forumRpc={rpc:async(name,args)=>{calls.push({name,args});const member={user_id:'member',email:'member@example.test',status,is_admin:false};
   if(name==='forum_threads_list')return {data:[{id:'thread',title:'Test question',body:'Test details for members',created_at:'2026-10-31T20:00:00Z',own:false,replies:0}],error:null};
   if(name==='forum_admin_members'||name==='forum_admin_author')return {data:[member],error:null};
   if(name==='forum_admin_moderate_member'){status=args.p_action==='ban'?'banned':args.p_action==='remove'?'removed':'active';return {data:null,error:null}};
   return {data:[],error:null};}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__forumRpc;');
  const compiled=await transformWithEsbuild(await readFile('src/CommunityForum.tsx','utf8'),'src/CommunityForum.tsx',{jsx:'automatic'});
  const path=join(dir,'CommunityForum.mjs');await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"'));
  const {CommunityForum}=await import(pathToFileURL(path).href);
  const button=(text)=>view.root.findAllByType('button').find(b=>b.children.some(c=>typeof c==='string'&&c===text));
  await act(async()=>{view=create(React.createElement(CommunityForum,{isAdmin:false}))});
  assert.equal(button('Manage author'),undefined);assert.equal(button('Manage community members'),undefined);
  await act(async()=>view.unmount());
  await act(async()=>{view=create(React.createElement(CommunityForum,{isAdmin:true}))});
  await act(async()=>button('Manage author').props.onClick());
  assert.equal(view.root.findByProps({id:'forum-author-controls'}).findByType('strong').children[0],'member@example.test');
  await act(async()=>button('Ban from participating').props.onClick());
  assert.equal(status,'banned');assert.deepEqual(calls.find(c=>c.name==='forum_admin_moderate_member').args,{p_user:'member',p_action:'ban'});
  await act(async()=>button('Manage community members').props.onClick());
  assert.ok(button('Restore access'));await act(async()=>button('Restore access').props.onClick());assert.equal(status,'active');
  await act(async()=>button('Remove member').props.onClick());assert.equal(status,'removed');
  assert.ok(button('Restore access'));assert.ok(calls.some(c=>c.name==='forum_admin_author'&&c.args.p_id==='thread'));
 }finally{if(view)await act(async()=>view.unmount());delete globalThis.__forumRpc;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldDocument===undefined)delete globalThis.document;else globalThis.document=oldDocument;await rm(dir,{recursive:true,force:true})}
});
