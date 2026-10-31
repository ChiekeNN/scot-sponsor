import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';

test('support request confirms only after the private RPC succeeds',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'support-test-'));
 try{
  let fail=true,calls=0,params;
  globalThis.__supportClient={rpc:async(name,p)=>{assert.equal(name,'request_application_support_for_job');calls++;params=p;return fail?{error:{message:'JOB_UNAVAILABLE'}}:{error:null,data:'request-id'}}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__supportClient;');
  const source=await readFile('src/ApplicationSupport.tsx','utf8');const compiled=await transformWithEsbuild(source,'src/ApplicationSupport.tsx',{jsx:'automatic'});
  const path=join(dir,'support.mjs');await writeFile(path,compiled.code.replace('"./directoryClient"','"./directoryClient.mjs"'));
  const {ApplicationSupport}=await import(pathToFileURL(path).href);let view;
  await act(async()=>{view=create(React.createElement(ApplicationSupport,{jobId:'job1',title:'Engineer',email:'member@example.test',onAccount(){}}))});
  const inputs=view.root.findAllByType('input');await act(async()=>{inputs[0].props.onChange({target:{value:'A Member'}});inputs[1].props.onChange({target:{checked:true}});view.root.findByType('textarea').props.onChange({target:{value:'My experience'}})});
  await act(async()=>{await view.root.findByType('form').props.onSubmit({preventDefault(){}})});
  assert.match(JSON.stringify(view.toJSON()),/no longer available/);assert.doesNotMatch(JSON.stringify(view.toJSON()),/Thank you/);
  fail=false;await act(async()=>{await view.root.findByType('form').props.onSubmit({preventDefault(){}})});
  assert.equal(calls,2);assert.equal(params.p_consent,true);assert.equal(params.p_name,'A Member');assert.equal(params.p_notes,'My experience');assert.match(JSON.stringify(view.toJSON()),/not been sent to the employer/);assert.match(JSON.stringify(view.toJSON()),/Thank you/);view.unmount();
 }finally{delete globalThis.__supportClient;await rm(dir,{recursive:true,force:true})}
});
