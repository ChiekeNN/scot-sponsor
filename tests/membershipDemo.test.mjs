import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('demo registration clearly describes plans, simulated payment and email verification', async () => {
  const s = await read('src/AccountCenter.tsx');
  for (const text of ['£9.99 / month','£24.99 one-off','Demo checkout · £0 charged','does not unlock paid member benefits','Email verified','not proof of identity or payment']) assert.ok(s.includes(text), text);
  assert.match(s, /required checked=\{demoConsent\}/);
  assert.match(s, /membership_demo_plan:chosenPlan/);
  assert.match(s, /card\?\.is_demo&&card\.demo_plan/);
  assert.match(s, /\(job \|\| isAdmin\)/);
  assert.match(s, /\(monthly \|\| isAdmin\)/);
});

test('membership IDs are server managed and demo activation cannot grant entitlements', async () => {
  const s = await read('supabase/migrations/20261101081000_membership_demo_identity.sql');
  assert.match(s, /user_id uuid primary key/);
  assert.match(s, /member_number text not null unique/);
  assert.match(s, /enable row level security/);
  assert.match(s, /revoke all on public\.member_identity_cards from public, anon, authenticated/);
  const demo = s.split('create function public.activate_demo_membership')[1].split('create function public.my_membership_card')[0];
  assert.match(demo, /email_confirmed_at is not null/);
  assert.doesNotMatch(demo, /insert into public\.member_entitlements|update public\.member_entitlements/i);
  assert.match(s, /cardinality\(active_plans\)>0/);
  assert.match(s, /demo is not null and not admin and cardinality\(active_plans\)=0/);
});

test('membership modal links directly to demo registration', async () => {
  assert.match(await read('src/Landing.tsx'), /Demo checkout only\. No payment is taken/);
  assert.match(await read('src/App.tsx'), /navigate\('account', true\)/);
});
