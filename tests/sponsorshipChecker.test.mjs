import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';

test('checker searches, selects, animates the matching evidence, and clearly discloses limitations',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'sponsor-check-'));
 try {
  const calls=[];globalThis.__checkerClient={rpc:async(name,args)=>{calls.push({name,args});return {data:{last_success:'2026-10-30T10:00:00Z',source_published:'2026-10-30T09:00:00Z',items:[{id:1,name:'Example Company',town:'Glasgow',region:'Glasgow City',status:'matched',entries:[{route:'Skilled Worker',rating:'Worker (A rating)'}]},{id:2,name:'Example Second',town:'Dundee',region:'',status:'unmatched',entries:[]},{id:3,name:'Example Third',town:'Ayr',region:'',status:'unavailable',entries:[]}]},error:null}}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__checkerClient;');
  const source=await readFile('src/SponsorshipChecker.tsx','utf8');const compiled=await transformWithEsbuild(source,'src/SponsorshipChecker.tsx',{jsx:'automatic'});const path=join(dir,'checker.mjs');await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"'));
  const {SponsorshipChecker}=await import(pathToFileURL(path).href);let view;await act(async()=>{view=create(React.createElement(SponsorshipChecker))});
  let text=JSON.stringify(view.toJSON());assert.match(text,/No 2023, 2024 or 2025 employer-level sponsorship history is currently connected/);assert.match(text,/The Sponsorship Checker Tool is provided for informational and guidance purposes only/);assert.match(text,/based on data obtained from the UKVI for 2023, 2024 and 2025/);
  await act(async()=>view.root.findByType('input').props.onChange({target:{value:'Example'}}));await act(async()=>{await view.root.findByType('form').props.onSubmit({preventDefault(){}})});assert.deepEqual(calls,[{name:'member_sponsorship_checker',args:{p_search:'Example'}}]);
  const choose=id=>view.root.findAllByType('button').find(b=>b.findAllByType('strong').some(child=>child.children.includes(id)));
  await act(async()=>choose('Example Company').props.onClick());text=JSON.stringify(view.toJSON());assert.match(text,/Register match found/);assert.match(text,/Skilled Worker/);assert.match(text,/rotate\(58deg\)/);
  await act(async()=>choose('Example Second').props.onClick());text=JSON.stringify(view.toJSON());assert.match(text,/No match in snapshot/);assert.match(text,/does not establish/);assert.match(text,/rotate\(0deg\)/);
  await act(async()=>choose('Example Third').props.onClick());text=JSON.stringify(view.toJSON());assert.match(text,/Snapshot unavailable/);assert.match(text,/rotate\(-58deg\)/);await act(async()=>view.unmount());
 }finally{delete globalThis.__checkerClient;await rm(dir,{recursive:true,force:true})}
});

test('server enforces membership and recency without broadening directory access',async()=>{
 const sql=await readFile('supabase/migrations/20261101020000_sponsorship_checker.sql','utf8');
 assert.match(sql,/auth\.uid\(\).*can_access_member_insights\(\)/i);assert.match(sql,/NOT_AUTHORISED/);assert.match(sql,/from public, anon, authenticated/i);assert.match(sql,/grant execute .* to authenticated/i);assert.match(sql,/limit 15/i);assert.match(sql,/interval '3 days'/i);assert.doesNotMatch(sql,/alter policy/i);
 const account=await readFile('src/AccountCenter.tsx','utf8');assert.match(account,/\(job \|\| monthly \|\| isAdmin\) && !loading && <SponsorshipChecker/);
 const css=await readFile('src/index.css','utf8');assert.match(css,/prefers-reduced-motion:reduce/);
});
