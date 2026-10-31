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
