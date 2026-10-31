import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('community discussion RPCs are member-gated, bounded and do not expose author identities',async()=>{
 const sql=await readFile('supabase/migrations/20261101110000_member_forum.sql','utf8');
 assert.match(sql,/email_confirmed_at is not null/);
 assert.match(sql,/not public\.can_access_member_insights\(\)/);
 assert.match(sql,/revoke all on public\.forum_threads,public\.forum_replies,public\.forum_reports from public,anon,authenticated/);
 assert.match(sql,/forum-cap/);assert.match(sql,/>=200/);
 assert.match(sql,/author_id=auth\.uid\(\) or public\.is_super_admin\(\)/);
 assert.match(sql,/if not public\.is_super_admin\(\)/);
 assert.match(sql,/returns table\(id uuid,title text,body text,created_at timestamptz,own boolean,replies bigint\)/);
 const ui=await readFile('src/CommunityForum.tsx','utf8');
 assert.doesNotMatch(ui,/dangerouslySetInnerHTML/);assert.match(ui,/forum_report/);assert.match(ui,/forum_resolve_report/);
});

test('community moderation is private, scoped, auditable and enforced server-side',async()=>{
 const sql=await readFile('supabase/migrations/20261101130000_forum_member_moderation.sql','utf8');
 assert.match(sql,/revoke all on public\.forum_member_restrictions,public\.forum_moderation_audit from public,anon,authenticated/);
 assert.match(sql,/if auth\.uid\(\) is null or not public\.is_super_admin\(\)/);
 assert.match(sql,/exists\(select 1 from public\.super_admins where user_id=p_user\)/);
 assert.match(sql,/forum_threads_guard before insert/);assert.match(sql,/forum_replies_guard before insert/);assert.match(sql,/forum_reports_guard before insert/);
 assert.match(sql,/pg_advisory_xact_lock/);assert.match(sql,/COMMUNITY_POSTING_RESTRICTED/);assert.match(sql,/COMMUNITY_REMOVED/);
 assert.match(sql,/delete from public\.forum_threads where author_id=p_user/);assert.match(sql,/delete from public\.forum_replies where author_id=p_user/);
 assert.doesNotMatch(sql,/delete from auth\.users/);assert.match(sql,/insert into public\.forum_moderation_audit/);
 const ui=await readFile('src/CommunityForum.tsx','utf8');assert.match(ui,/isAdmin&&<button onClick=\{\(\)=>void identify/);assert.match(ui,/forum_admin_author/);assert.match(ui,/Their platform account and pass will remain/);assert.match(ui,/Restore access/);
});
