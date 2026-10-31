import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';

test('homepage links navigate to the filtered live feed; direct links and browser history work for signed-in users',async()=>{
 const old={window:globalThis.window,document:globalThis.document,localStorage:globalThis.localStorage};
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'browse-route-'));
 try{
  let location=new URL('https://example.test/');const handlers={};let focus=0,scrolled=0;
  const update=url=>{location=new URL(url,location.href)};
  globalThis.window={get location(){return location},history:{pushState(_a,_b,url){update(url)},replaceState(_a,_b,url){update(url)}},addEventListener(name,cb){handlers[name]=cb},removeEventListener(name){delete handlers[name]},scrollTo(){},requestAnimationFrame(cb){cb();return 1},cancelAnimationFrame(){}};
  globalThis.document={getElementById(){return {scrollIntoView(){scrolled++},focus(){focus++}}}};
  globalThis.localStorage={getItem(){return null},setItem(){}};
  let currentSession=null;
  globalThis.__browseAuth={auth:{getSession:async()=>({data:{session:currentSession}}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})}};
  const noop='import React from "react";export const component=()=>React.createElement("div");';
  const stubs={
   Features:`${noop} export const HomePage=component,ToolsPage=component,TrackerPage=component,InstallCard=component;`,
   Landing:'import React from "react";export const PublicLanding=({onBrowse})=>React.createElement("button",{id:"browse-go",onClick:()=>onBrowse({kind:"industry",id:"engineering"})},"Browse engineering");export const AccessModal=()=>null;',
   plans:'export const plans={monthly:{name:"monthly",price:"",period:"",description:"",features:[],terms:""},jobHunt:{name:"job",price:"",period:"",description:"",features:[],terms:""}};',
   CvStudio:`${noop} export const CvStudio=component;`,Journal:`${noop} export const Journal=component;`,SponsorDirectory:`${noop} export const SponsorDirectory=component;`,AccountCenter:`${noop} export const AccountCenter=component;`,
   AdminAlerts:`${noop} export const AdminAlerts=component;export const useAdminAlerts=()=>({isAdmin:false,feed:null,error:null,refresh(){}});`,
   ImmigrationInsights:`${noop} export const ImmigrationInsights=component;`,MemberTools:`${noop} export const MemberTools=component;`,
   PartnerJobs:'import React from "react";export const PartnerJobs=({browseSelection,onClearBrowse})=>React.createElement("button",{id:"live-feed",onClick:onClearBrowse},browseSelection?`${browseSelection.kind}/${browseSelection.id}`:"all jobs");',
   directoryClient:'export const directoryClient=globalThis.__browseAuth;'
  };
  for(const [name,source] of Object.entries(stubs))await writeFile(join(dir,`${name}.mjs`),source);
  const compiled=await transformWithEsbuild(await readFile('src/App.tsx','utf8'),'src/App.tsx',{jsx:'automatic'});let code=compiled.code;
  for(const name of Object.keys(stubs))code=code.replace(`"./${name}"`,`"./${name}.mjs"`);
  code=code.replace('"./jobBrowse.mjs"',JSON.stringify(pathToFileURL(join(process.cwd(),'src/jobBrowse.mjs')).href));
  const path=join(dir,'App.mjs');await writeFile(path,code);const {default:App}=await import(pathToFileURL(path).href);
  let view;await act(async()=>{view=create(React.createElement(App))});
  await act(async()=>view.root.findByProps({id:'browse-go'}).props.onClick());
  assert.equal(location.search,'?browse=industry&id=engineering');assert.equal(view.root.findByProps({id:'live-feed'}).children[0],'industry/engineering');assert.equal(view.root.findAllByProps({className:'demo-notice'}).length,0);assert.ok(scrolled>0);assert.ok(focus>0);
  await act(async()=>view.root.findByProps({id:'live-feed'}).props.onClick());assert.equal(location.search,'');assert.equal(view.root.findByProps({id:'live-feed'}).children[0],'all jobs');
  update('/?browse=location&id=glasgow#scotland-jobs');await act(async()=>handlers.popstate());assert.equal(view.root.findByProps({id:'live-feed'}).children[0],'location/glasgow');
  update('/');await act(async()=>handlers.popstate());assert.equal(view.root.findAllByProps({id:'browse-go'}).length,1);
  await act(async()=>view.unmount());
  update('/?browse=popular&id=developer#scotland-jobs');currentSession={user:{id:'member'}};
  await act(async()=>{view=create(React.createElement(App))});assert.equal(view.root.findByProps({id:'live-feed'}).children[0],'popular/developer');assert.equal(view.root.findAllByProps({id:'browse-go'}).length,0);await act(async()=>view.unmount());
 }finally{delete globalThis.__browseAuth;for(const [key,value] of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}await rm(dir,{recursive:true,force:true})}
});
