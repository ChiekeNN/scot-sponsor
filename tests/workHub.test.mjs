import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source=await readFile(new URL('../src/workHub.ts',import.meta.url),'utf8');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {workHubSearchUrl}=await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('Work Hub link keeps Scotland fixed and encodes user search safely',()=>{
 const u=new URL(workHubSearchUrl('  nurse & care  ',true));
 assert.equal(u.origin,'https://www.jobs.service.gov.uk');assert.equal(u.pathname,'/jobs/search');
 assert.equal(u.searchParams.get('keywords'),'nurse & care visa sponsorship');assert.equal(u.searchParams.get('locationId'),'country-scotland');assert.equal(u.searchParams.get('location'),'Scotland, Scotland');
 assert.equal(new URL(workHubSearchUrl()).searchParams.get('keywords'),'');
});
test('Work Hub search clearly distinguishes keyword matches from sponsorship verification',async()=>{
 const ui=await readFile(new URL('../src/WorkHub.tsx',import.meta.url),'utf8');
 assert.match(ui,/do not/);assert.match(ui,/confirm with the employer/i);assert.match(ui,/no live sponsored-job badges/i);assert.match(ui,/target="_blank"/);assert.doesNotMatch(ui,/fetch\(/);
});
