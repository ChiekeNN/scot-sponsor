import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';

test('public immigration guides, checklists and FAQ render and checklist controls work',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'resources-'));
 try{
  for(const name of ['ImmigrationGuide','HomeFaq']){
   const result=await transformWithEsbuild(await readFile(`src/${name}.tsx`,'utf8'),`src/${name}.tsx`,{jsx:'automatic'});
   await writeFile(join(dir,`${name}.mjs`),result.code);
  }
  const {ImmigrationGuide}=await import(pathToFileURL(join(dir,'ImmigrationGuide.mjs')).href);
  const {HomeFaq}=await import(pathToFileURL(join(dir,'HomeFaq.mjs')).href);
  let view;await act(async()=>{view=create(React.createElement(ImmigrationGuide))});
  assert.equal(view.root.findAllByProps({id:'immigration-guide'}).length,1);
  assert.equal(view.root.findAllByProps({id:'essential-checklists'}).length,1);
  const cards=view.root.findAllByProps({className:'route-card'});assert.equal(cards.length,9);
  const texts=JSON.stringify(view.toJSON());
  for(const name of ['Student Visa','Employers','Skilled Worker Route','High Potential Individual (HPI)','Graduate Immigration Route (GIR)','Innovator Founder visa','Global Talent Visa','Government Authorised Exchange (GAE)','Youth Mobility Scheme (YMS)'])assert.ok(texts.includes(name),name);
  assert.equal(view.root.findAll(node=>node.type==='a' && node.props.href?.startsWith('https://www.gov.uk/')).length,12);
  const boxes=view.root.findAllByProps({type:'checkbox'});assert.equal(boxes.length,16);
  await act(async()=>boxes[0].props.onChange({target:{checked:true}}));
  assert.equal(view.root.findAllByProps({type:'checkbox'})[0].props.checked,true);
  assert.ok(JSON.stringify(view.toJSON()).includes('1 / '));
  const clear=view.root.findAllByType('button').find(node=>node.children.includes('Clear ticks'));assert.equal(clear.props.disabled,false);
  await act(async()=>clear.props.onClick());assert.equal(view.root.findAllByProps({type:'checkbox'})[0].props.checked,false);
  await act(async()=>view.unmount());
  await act(async()=>{view=create(React.createElement(HomeFaq))});
  assert.equal(view.root.findAllByProps({id:'faq'}).length,1);
  assert.equal(view.root.findAllByType('details').length,8);
  const faq=JSON.stringify(view.toJSON());assert.match(faq,/not currently delivered to the employer/);assert.match(faq,/not an employer’s ATS/);assert.match(faq,/free to read/i);
  await act(async()=>view.unmount());
 }finally{await rm(dir,{recursive:true,force:true})}
});

test('resources and FAQ are public homepage sections and immigration guide is also in the workspace',async()=>{
 const landing=await readFile('src/Landing.tsx','utf8'),app=await readFile('src/App.tsx','utf8');
 assert.match(landing,/<ImmigrationGuide\/>/);assert.match(landing,/<HomeFaq\/>/);assert.match(landing,/href="#faq"/);
 assert.match(app,/page === 'guide' \? <ImmigrationGuide\/>/);
 for(const hash of ['#immigration-guide','#essential-checklists','#faq'])assert.ok(app.includes(hash));
});
