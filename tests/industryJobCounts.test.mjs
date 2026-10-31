import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {browseGroups} from '../src/jobBrowse.mjs';

test('industry count request fits server bounds and exactly matches search options',async()=>{
 assert.equal(browseGroups.industry.length,28);
 for(const item of browseGroups.industry){assert.equal(item.includeExcerpt,false);assert.deepEqual(item.titleTerms,[]);assert.ok(item.terms.length>0&&item.terms.length<=30);assert.ok(item.terms.every(t=>t.length>0&&t.length<=100));}
 const sql=await readFile('supabase/migrations/20261101100000_public_industry_job_counts.sql','utf8');
 assert.match(sql,/public\.public_job_search\(0,1,'','','industry'/);
 assert.match(sql,/jsonb_array_length\(p_categories\) not between 1 and 28/);
 assert.match(sql,/jsonb_array_length\(category->'terms'\) not between 1 and 30/);
 assert.match(sql,/category_id=any\(seen\)/);
 assert.match(sql,/grant execute on function public\.public_industry_job_counts\(jsonb\) to anon,authenticated,service_role/i);
 assert.doesNotMatch(sql,/grant .* on (?:table )?public\.partner_jobs/i);
});
