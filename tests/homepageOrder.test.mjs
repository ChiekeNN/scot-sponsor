import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('homepage places Scotland insights directly after the hero and before the member-only job entry',async()=>{
 const source=await readFile('src/Landing.tsx','utf8');
 const hero=source.indexOf('<section className="public-hero">');
 assert.notEqual(hero,-1);
 const heroEnd=source.indexOf('</section>',hero)+'</section>'.length;
 assert.match(source.slice(heroEnd),/^\s*<SponsorInsights\/>\s*<section className="public-intro" id="scotland-jobs"/);
 assert.equal((source.match(/<SponsorInsights\s*\/>/g)||[]).length,1);
 assert.equal((source.match(/<PartnerJobs\b/g)||[]).length,0);
 assert.match(source,/Sign in with an active membership/);
 assert.match(source,/<JobBrowse onBrowse=\{onBrowse\}\s*\/>/);
});
