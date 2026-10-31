import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';

test('requested messages are absent from the platform while government credits remain accessible',async()=>{
 const files=(await readdir('src')).filter(path=>/\.(tsx|ts|mjs)$/.test(path));
 for(const file of files){
  const content=await readFile(`src/${file}`,'utf8');
  assert.doesNotMatch(content,/Private on this device:|Your CV draft and analysis stay in this browser\. The keyword check is a guide/);
  assert.doesNotMatch(content,/A starting point, not immigration advice\.|These summaries were checked against the linked GOV\.UK pages/);
  assert.doesNotMatch(content,/Member job alerts are not live yet\.|Email and messaging delivery are not connected, even for active passes\./);
  assert.doesNotMatch(content,/Contains public sector information licensed under the|Independent service; not affiliated with the UK Government\./);
 }
 for(const file of ['SponsorshipChecker.tsx','ImmigrationInsights.tsx']){
  const content=await readFile(`src/${file}`,'utf8');
  assert.match(content,/https:\/\/github\.com\/ChiekeNN\/scot-sponsor\/blob\/main\/docs\/data-attribution\.md/);
 }
 const credits=await readFile('docs/data-attribution.md','utf8');
 assert.match(credits,/Contains public sector information licensed under the/);
 assert.match(credits,/https:\/\/www\.nationalarchives\.gov\.uk\/doc\/open-government-licence\/version\/3\//);
 assert.match(credits,/register-of-licensed-sponsors-workers/);
});
