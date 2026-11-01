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
    await writeFile(join(dir, 'plans.mjs'), 'export const plans={monthly:{features:[]},jobHunt:{features:[]}};');
    await writeFile(join(dir, 'PasswordField.mjs'), 'export const PasswordField = () => null;');
    await writeFile(join(dir, 'AdminAnalytics.mjs'), 'export const AdminAnalytics = () => null;');
    await writeFile(join(dir, 'AdminApplications.mjs'), 'export const AdminApplications = () => null;');
    await writeFile(join(dir, 'AdminJobApplications.mjs'), 'export const AdminJobApplications = () => null;');
    await writeFile(join(dir, 'AdminMembers.mjs'), 'import React from "react"; export const AdminMembers = () => React.createElement("div", null, "Member management");');
    await writeFile(join(dir, 'SponsorshipChecker.mjs'), 'import React from "react"; export const SponsorshipChecker = () => React.createElement("div", null, "Subscriber checker");');
    const source = await readFile('src/AccountCenter.tsx', 'utf8');
    const compiled = await transformWithEsbuild(source, 'src/AccountCenter.tsx', { jsx: 'automatic' });
    const code = compiled.code.replace('"./directoryClient"', '"./directoryClient.mjs"').replace('"./plans"', '"./plans.mjs"').replace('"./PasswordField"', '"./PasswordField.mjs"').replace('"./AdminAnalytics"', '"./AdminAnalytics.mjs"').replace('"./AdminApplications"', '"./AdminApplications.mjs"').replace('"./AdminJobApplications"', '"./AdminJobApplications.mjs"').replace('"./AdminMembers"', '"./AdminMembers.mjs"').replace('"./SponsorshipChecker"', '"./SponsorshipChecker.mjs"');
    const path = join(dir, 'AccountCenter.mjs'); await writeFile(path, code);
    const { AccountCenter } = await import(pathToFileURL(path).href);
    let directoryOpened = false;
    const props = { session: { user: { id: 'admin', email: 'admin@example.test' } }, recovering: false, onRecoveryComplete() {}, goDirectory() { directoryOpened = true; }, goCv() {}, goTools() {}, goJournal() {}, goAlerts() {}, goInsights() {}, goCover() {}, goPlanner() {} };
    let view;
    await act(async () => { view = create(React.createElement(AccountCenter, props)); });
    const text = JSON.stringify(view.toJSON());
    assert.match(text, /Job Hunt Pass tools/); assert.match(text, /Monthly Alert Pass tools/);
    assert.match(text, /Subscriber checker/); assert.match(text, /Unlimited access · no expiry/); assert.match(text, /Sponsor directory/); assert.match(text, /AI cover letter generator/); assert.match(text, /Graduate Visa Switch Planner/);
    const buttons = () => view.root.findAllByType('button');
    const content = node => typeof node === 'string' ? node : (node.children || []).map(content).join(' ');
    const hasText = (element, value) => content(element).includes(value);
    await act(async () => { buttons().find(button => hasText(button, 'Sponsor directory')).props.onClick(); });
    assert.equal(directoryOpened, true);
    await act(async () => { buttons().find(button => hasText(button, 'Admin console')).props.onClick(); });
    assert.match(JSON.stringify(view.toJSON()), /Member management/);
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

test('checker appears only on active subscriber dashboards or the admin dashboard', async () => {
 const cache=join(process.cwd(),'node_modules','.cache');await mkdir(cache,{recursive:true});const dir=await mkdtemp(join(cache,'account-gate-'));
 try{
  let entitlements=[];globalThis.__accountGateClient={from:()=>({select:async()=>({data:entitlements,error:null})}),rpc:async()=>({data:false,error:null}),auth:{signOut:async()=>({error:null})}};
  await writeFile(join(dir,'directoryClient.mjs'),'export const directoryClient=globalThis.__accountGateClient;');
  await writeFile(join(dir,'plans.mjs'),'export const plans={monthly:{features:[]},jobHunt:{features:[]}};');
  for(const name of ['PasswordField','AdminAnalytics','AdminApplications','AdminJobApplications','AdminMembers'])await writeFile(join(dir,`${name}.mjs`),`export const ${name}=()=>null;`);
  await writeFile(join(dir,'SponsorshipChecker.mjs'),'import React from "react";export const SponsorshipChecker=()=>React.createElement("div",null,"Subscriber checker");');
  const source=await readFile('src/AccountCenter.tsx','utf8');const compiled=await transformWithEsbuild(source,'src/AccountCenter.tsx',{jsx:'automatic'});let code=compiled.code;
  for(const name of ['directoryClient','plans','PasswordField','AdminAnalytics','AdminApplications','AdminJobApplications','AdminMembers','SponsorshipChecker'])code=code.replace(`"./${name}"`,`"./${name}.mjs"`);
  const path=join(dir,'account.mjs');await writeFile(path,code);const {AccountCenter}=await import(pathToFileURL(path).href);
  const props={recovering:false,onRecoveryComplete(){},goDirectory(){},goCv(){},goTools(){},goJournal(){},goAlerts(){},goInsights(){},goCover(){},goPlanner(){}};
  const future=new Date(Date.now()+86400000).toISOString(),past=new Date(Date.now()-86400000).toISOString();
  for(const [passes,expected] of [[[],false],[[{plan:'monthly_alert_pass',starts_at:past,expires_at:future,revoked_at:null}],true],[[{plan:'job_hunt_pass',starts_at:past,expires_at:future,revoked_at:null}],true],[[{plan:'job_hunt_pass',starts_at:past,expires_at:future,revoked_at:past}],false],[[{plan:'monthly_alert_pass',starts_at:past,expires_at:past,revoked_at:null}],false]]) {
    entitlements=passes;let view;await act(async()=>{view=create(React.createElement(AccountCenter,{...props,session:{user:{id:'member',email:'member@example.test'}}}))});assert.equal(JSON.stringify(view.toJSON()).includes('Subscriber checker'),expected);await act(async()=>view.unmount());
  }
 }finally{delete globalThis.__accountGateClient;await rm(dir,{recursive:true,force:true})}
});
