import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import React from 'react';
import {create,act} from 'react-test-renderer';
import {transformWithEsbuild} from 'vite';
import {browseGroups,browseFromSearch,browseHref,clearBrowseUrl,getBrowseItem,matchesBrowse} from '../src/jobBrowse.mjs';

const labels=list=>list.map(item=>item.label);
test('every requested industry and popular job has its own valid browse link',()=>{
 assert.deepEqual(labels(browseGroups.industry),['Accounting & Finance Jobs','Admin Jobs','Charity & Voluntary Jobs','Consultancy Jobs','Creative & Design Jobs','Customer Services Jobs','Domestic help & Cleaning Jobs','Energy, Oil & Gas Jobs','Engineering Jobs','Graduate Jobs','HR & Recruitment Jobs','Healthcare & Nursing Jobs','Hospitality & Catering Jobs','IT Jobs','Legal Jobs','Logistics & Warehouse Jobs','Maintenance Jobs','Manufacturing Jobs','Other/General Jobs','PR, Advertising & Marketing Jobs','Property Jobs','Retail Jobs','Sales Jobs','Scientific & QA Jobs','Social work Jobs','Teaching Jobs','Trade & Construction Jobs','Travel Jobs']);
 assert.deepEqual(labels(browseGroups.popular),['No Experience Jobs','IT Support Jobs','IT Manager Jobs','Management Jobs','Operations Jobs','Communications Jobs','Planning Jobs','Operator Jobs','Manager Jobs','Medical Jobs','Assistant Jobs','IT Training Jobs','Training Jobs','Education Jobs','Disability Jobs','Developer Jobs','Insurance Jobs','Wellness Jobs','Scheduler Jobs','Law Jobs','Flexible Jobs','Policy Jobs','Physics Jobs','Industrial Jobs','School Jobs','Reporter Jobs','Designer Jobs','Packaging Jobs','Recruitment Jobs','IT Recruiter Jobs']);
 for(const [kind,items] of Object.entries(browseGroups)){assert.equal(new Set(items.map(i=>i.id)).size,items.length);for(const item of items){const selection={kind,id:item.id};const href=browseHref(selection);assert.deepEqual(browseFromSearch(new URL(href,'https://example.test/').search),selection);assert.equal(getBrowseItem(selection).label,item.label)}}
 assert.equal(browseFromSearch('?browse=industry&id=does-not-exist'),null);assert.equal(browseFromSearch('?browse=__proto__&id=constructor'),null);
 assert.equal(clearBrowseUrl('https://example.test/?other=1&browse=industry&id=it#scotland-jobs'),'/?other=1');
});
test('industry, job and location filters match relevant text without substring collisions',()=>{
 const sample=(title,location='Glasgow, Scotland',description='')=>({title,location,description});
 assert.equal(matchesBrowse(sample('Finance Manager'),{kind:'industry',id:'accounting-finance'}),true);
 assert.equal(matchesBrowse(sample('Hospital Porter'),{kind:'industry',id:'it'}),false);
 assert.equal(matchesBrowse(sample('IT Support Analyst'),{kind:'industry',id:'it'}),true);
 assert.equal(matchesBrowse(sample('Support Worker','Dundee','No experience required, full training offered.'),{kind:'popular',id:'no-experience'}),true);
 assert.equal(matchesBrowse(sample('Junior Consultant'),{kind:'popular',id:'no-experience'}),false);
 assert.equal(matchesBrowse(sample('No Experience Jobs'),{kind:'popular',id:'no-experience'}),true);
 assert.equal(matchesBrowse(sample('Recruiter - IT'),{kind:'popular',id:'it-recruiter'}),true);
 assert.equal(matchesBrowse(sample('Operator','Aberdeen, Scotland'),{kind:'location',id:'aberdeen'}),true);
 assert.equal(matchesBrowse(sample('Operator','Aberdeenshire, Scotland'),{kind:'location',id:'aberdeen'}),false);
 assert.equal(matchesBrowse(sample('Operator','Aberdeenshire, Scotland'),{kind:'location',id:'aberdeenshire'}),true);
 assert.equal(matchesBrowse(sample('Engineer'),null),true);
});

test('homepage browser exposes genuine links and hands the selected category to navigation',async()=>{
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'browse-test-'));
 try{
  const source=await readFile('src/JobBrowse.tsx','utf8');const compiled=await transformWithEsbuild(source,'src/JobBrowse.tsx',{jsx:'automatic'});const path=join(dir,'browse.mjs');await writeFile(path,compiled.code.replace('"./jobBrowse.mjs"',JSON.stringify(pathToFileURL(join(process.cwd(),'src/jobBrowse.mjs')).href)));
  const {JobBrowse}=await import(pathToFileURL(path).href);let selected=null;let view;await act(async()=>{view=create(React.createElement(JobBrowse,{onBrowse:x=>{selected=x}}))});
  const text=()=>JSON.stringify(view.toJSON());assert.match(text(),/Browse by industry/);assert.match(text(),/Accounting & Finance Jobs/);assert.equal(view.root.findAllByType('a').length,28);
  const engineering=view.root.findAllByType('a').find(a=>a.props.href==='?browse=industry&id=engineering#scotland-jobs');assert.ok(engineering);let prevented=false;await act(async()=>{engineering.props.onClick({button:0,preventDefault(){prevented=true}})});assert.equal(prevented,true);assert.deepEqual(selected,{kind:'industry',id:'engineering'});
  prevented=false;engineering.props.onClick({button:0,ctrlKey:true,preventDefault(){prevented=true}});assert.equal(prevented,false);
  await act(async()=>{view.root.findAllByType('button').find(b=>b.props.children.some?.(c=>c==='Browse by popular jobs')).props.onClick()});assert.match(text(),/No Experience Jobs/);assert.equal(view.root.findAllByType('a').length,30);
  await act(async()=>{view.root.findAllByType('button').find(b=>b.props.children.some?.(c=>c==='Browse by location')).props.onClick()});assert.match(text(),/Glasgow Jobs/);assert.match(text(),/Edinburgh Jobs/);assert.equal(view.root.findAllByType('a').length,browseGroups.location.length);
  await act(async()=>view.unmount());
 }finally{await rm(dir,{recursive:true,force:true})}
});
