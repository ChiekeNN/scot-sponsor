import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { transformWithEsbuild } from 'vite';

test('super admin sees both dashboards without expiry and no self-grant buttons', async () => {
  const cache = join(process.cwd(), 'node_modules', '.cache');
  await mkdir(cache, { recursive: true });
  const dir = await mkdtemp(join(cache, 'admin-test-'));
  try {
    globalThis.__accountTestClient = {
      from: () => ({ select: async () => ({ data: [], error: null }) }),
      rpc: async name => ({ data: name === 'is_super_admin' ? true : [
        { user_id: 'admin', email: 'admin@example.test', email_confirmed: true, plan: null },
        { user_id: 'member', email: 'member@example.test', email_confirmed: true, plan: null },
      ], error: null }),
      auth: { signOut: async () => ({ error: null }) },
    };
    await writeFile(join(dir, 'directoryClient.mjs'), 'export const directoryClient = globalThis.__accountTestClient;');
    await writeFile(join(dir, 'PasswordField.mjs'), 'export const PasswordField = () => null;');
    const source = await readFile('src/AccountCenter.tsx', 'utf8');
    const compiled = await transformWithEsbuild(source, 'src/AccountCenter.tsx', { jsx: 'automatic' });
    const code = compiled.code.replace('"./directoryClient"', '"./directoryClient.mjs"').replace('"./PasswordField"', '"./PasswordField.mjs"');
    const path = join(dir, 'AccountCenter.mjs'); await writeFile(path, code);
    const { AccountCenter } = await import(pathToFileURL(path).href);
    let directoryOpened = false;
    const props = { session: { user: { id: 'admin', email: 'admin@example.test' } }, recovering: false, onRecoveryComplete() {}, goDirectory() { directoryOpened = true; }, goCv() {}, goTools() {}, goJournal() {} };
    let view;
    await act(async () => { view = create(React.createElement(AccountCenter, props)); });
    const text = JSON.stringify(view.toJSON());
    assert.match(text, /Job Hunt Pass tools/); assert.match(text, /Monthly Alert Pass tools/);
    assert.match(text, /Unlimited access · no expiry/); assert.match(text, /Sponsor directory/);
    const buttons = () => view.root.findAllByType('button');
    const content = node => typeof node === 'string' ? node : (node.children || []).map(content).join(' ');
    const hasText = (element, value) => content(element).includes(value);
    await act(async () => { buttons().find(button => hasText(button, 'Sponsor directory')).props.onClick(); });
    assert.equal(directoryOpened, true);
    await act(async () => { buttons().find(button => hasText(button, 'Admin console')).props.onClick(); });
    const cards = view.root.findAllByType('article');
    assert.equal(cards.length, 2);
    assert.match(content(cards[0]), /Super admin · unlimited access/);
    assert.equal(cards[0].findAllByType('button').length, 0);
    assert.equal(cards[1].findAllByType('button').length, 2);
    view.unmount();
  } finally { delete globalThis.__accountTestClient; await rm(dir, { recursive: true, force: true }); }
});

test('directory access migration keeps the paid check and adds the server-managed admin role', async () => {
  const sql = await readFile('supabase/migrations/20261030204420_super_admin_platform_access.sql', 'utf8');
  assert.match(sql, /public\.is_super_admin\(\) or public\.has_job_hunt_pass\(\)/i);
  assert.match(sql, /revoke all on function public\.can_access_job_hunt\(\) from public, anon/i);
  assert.match(sql, /alter policy "members read active directory"/i);
  assert.match(sql, /alter policy "members read active directory metadata"/i);
});
