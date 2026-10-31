import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('homepage places Scotland insights directly after the hero and before the public job feed',async()=>{
 const source=await readFile('src/Landing.tsx','utf8');
 const hero=source.indexOf('<section className="public-hero">');
 assert.notEqual(hero,-1);
 const heroEnd=source.indexOf('</section>',hero)+'</section>'.length;
 assert.match(source.slice(heroEnd),/^\s*<SponsorInsights\/>\s*\{jobFeed\}<JobBrowse/);
 assert.equal((source.match(/<SponsorInsights\s*\/>/g)||[]).length,1);
 assert.equal((source.match(/<PartnerJobs\b/g)||[]).length,0);
 assert.doesNotMatch(source,/SCOTTISH OPPORTUNITIES|Your next role|A little note:|ScotSponsor is currently a preview/);
 assert.match(source,/\{jobFeed\}<JobBrowse/);
 assert.match(source,/<JobBrowse onBrowse=\{onBrowse\}\s*\/>/);
});

test('the two requested notices are removed from the homepage without hiding jobs or insights',async()=>{
 const insights=await readFile('src/SponsorInsights.tsx','utf8');
 const app=await readFile('src/App.tsx','utf8');
 const landing=await readFile('src/Landing.tsx','utf8');
 assert.doesNotMatch(insights,/A snapshot, not a live register\.|The supplied report does not state when its data was captured/);
 assert.match(landing,/<SponsorInsights\/>/);
 assert.match(app,/showLanding && <PublicLanding jobFeed=\{<PartnerJobs/);
});

test('the requested platform notices are not rendered',async()=>{
 const checks = [
  ['src/Features.tsx',['A note before you begin:', 'Stored only in this browser on this device. Clearing browser data removes it; it does not sync or send reminders.']],
  ['src/PartnerJobs.tsx',['Only available jobs with complete descriptions are shown. Jobs and their details can change or close.']],
  ['src/App.tsx',['A note on eligibility']],
  ['src/MemberTools.tsx',['Planning guidance, not immigration advice.']],
  ['src/SponsorDirectory.tsx',['About this directory:']],
  ['src/ImmigrationInsights.tsx',['Information, not an eligibility decision.','A simple arithmetic estimate, not an assessment of visa salary rules']]
 ];
 for (const [path,phrases] of checks) {const source=await readFile(path,'utf8');for(const phrase of phrases)assert.ok(!source.includes(phrase),`${path} still includes ${phrase}`);}
});
