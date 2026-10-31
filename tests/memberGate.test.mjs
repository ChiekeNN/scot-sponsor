import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('historical membership migration protected listings and still protects chats', async () => {
 const sql=await readFile('supabase/migrations/20261101082000_membership_access_gate.sql','utf8');
 assert.match(sql,/revoke all on function public\.member_job_list_impl[^;]+from public,anon,authenticated/i);
 assert.match(sql,/revoke all on function public\.public_job_list[^;]+from public,anon/i);
 assert.equal((sql.match(/ACTIVE_MEMBERSHIP_REQUIRED/g)||[]).length,5);
 assert.match(sql,/public\.can_access_member_insights\(\)/);
 assert.match(sql,/chat_can_access[\s\S]+public\.can_access_member_insights\(\)/);
});

test('workspace and admin dashboard are mounted only after access checks',async()=>{
 const app=await readFile('src/App.tsx','utf8');
 assert.match(app,/!showLanding && hasMemberAccess && <div className="app-shell">/);
 assert.match(app,/adminAlerts\.isAdmin && <button className=\{page === 'home'/);
 assert.match(app,/page === 'home' \? \(adminAlerts\.isAdmin/);
 assert.match(app,/page === 'cv' \? \(accessForSession\?\.jobHunt/);
 assert.match(app,/access\?\.userId === session\.user\.id/);
 assert.match(app,/if \(event === 'SIGNED_OUT'\).*setShowLanding\(true\)/);
});


test('only complete public job projections are opened to anonymous users',async()=>{
 const sql=await readFile('supabase/migrations/20261101090000_public_job_access.sql','utf8');
 assert.match(sql,/grant execute on function public\.public_job_list[\s\S]*to anon,authenticated,service_role/i);
 assert.match(sql,/select \* from public\.member_job_search_impl/);assert.match(sql,/select public\.member_job_detail_impl/);
 assert.doesNotMatch(sql,/grant .* on (?:table )?public\.partner_jobs/i);assert.doesNotMatch(sql,/can_access_member_insights/);
 const app=await readFile('src/App.tsx','utf8');assert.match(app,/showLanding && <PublicLanding jobFeed=\{<PartnerJobs/);
});
