import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';

test('anonymous visitors can browse, search and read full photographed journal articles on the homepage', async () => {
 const old={window:globalThis.window,document:globalThis.document};
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'public-journal-'));
 try {
  let location=new URL('https://example.test/');const handlers=new Map();
  globalThis.window={get location(){return location},addEventListener(name,fn){handlers.set(name,fn)},removeEventListener(name){handlers.delete(name)}};
  globalThis.document={getElementById(){return {scrollIntoView(){}}}};
  const compile=async(name,ext='tsx')=>{
   let code=(await transformWithEsbuild(await readFile(`src/${name}.${ext}`,'utf8'),`src/${name}.${ext}`,{jsx:'automatic'})).code;
   for(const dependency of ['plans','guides','Journal','SponsorInsights','JobBrowse','ImmigrationGuide','HomeFaq']) code=code.replace(`"./${dependency}"`,`"./${dependency}.mjs"`);
   await writeFile(join(dir,`${name}.mjs`),code);
  };
  await compile('plans','ts');await compile('guides','ts');await compile('Journal');await compile('ImmigrationGuide');await compile('HomeFaq');await compile('Landing');
  await writeFile(join(dir,'SponsorInsights.mjs'),'import React from "react";export const SponsorInsights=()=>React.createElement("div");');
  await writeFile(join(dir,'JobBrowse.mjs'),'import React from "react";export const JobBrowse=()=>React.createElement("div");');
  const {PublicLanding}=await import(pathToFileURL(join(dir,'Landing.mjs')).href);
  let view;const noop=()=>{};
  await act(async()=>{view=create(React.createElement(PublicLanding,{onDemo:noop,onMembership:noop,onSignIn:noop,onBrowse:noop}))});
  assert.equal(view.root.findAllByProps({id:'journal'}).length,1);
  assert.ok(JSON.stringify(view.toJSON()).includes('Free to read, no sign-in required.'));
  assert.ok(view.root.findAllByProps({className:'journal-card'}).length >= 10);
  const input=view.root.findByProps({placeholder:'Search advice...'});
  await act(async()=>input.props.onChange({target:{value:'STAR'}}));
  assert.ok(view.root.findAllByProps({className:'journal-card'}).length > 0);
  assert.ok(view.root.findAllByProps({className:'journal-card'}).length < 10);
  location=new URL('https://example.test/#guide-answer-interview-questions-with-star');
  await act(async()=>handlers.get('hashchange')());
  assert.equal(view.root.findAllByProps({id:'guide-answer-interview-questions-with-star'}).length,1);
  assert.equal(view.root.findAllByProps({className:'article-content'}).length,1);
  assert.ok(view.root.findAllByProps({className:'journal-cover-image'}).length > 0);
  location=new URL('https://example.test/#journal');
  await act(async()=>handlers.get('hashchange')());
  assert.equal(view.root.findAllByProps({className:'journal-grid'}).length,1);
  await act(async()=>view.unmount());
 } finally {
  for(const [key,value] of Object.entries(old)){if(value===undefined)delete globalThis[key];else globalThis[key]=value}
  await rm(dir,{recursive:true,force:true});
 }
});
