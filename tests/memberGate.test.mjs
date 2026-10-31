import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('database boundaries protect listings and chats, not just page navigation', async () => {
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
