import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, writeFile, rm, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import React from 'react';
import { create, act } from 'react-test-renderer';
import { transformWithEsbuild } from 'vite';

test('company check opens the selected sponsor, automatically loads an exact match and handles incomplete searches', async () => {
  const cache = join(process.cwd(), 'node_modules', '.cache');
  await mkdir(cache, { recursive: true });
  const temp = await mkdtemp(join(cache, 'health-test-'));
  const originalFetch = globalThis.fetch;
  try {
    const source = await readFile('src/CompanyHealth.tsx', 'utf8');
    const { code } = await transformWithEsbuild(source, 'src/CompanyHealth.tsx', { jsx: 'automatic' });
    await writeFile(join(temp, 'directoryClient.mjs'), "export const directoryClient = { auth: { getSession: async () => ({ data: { session: { access_token: 'test-token' } } }) } };\n");
    const componentPath = join(temp, 'CompanyHealth.mjs');
    await writeFile(componentPath, code.replace("from \"./directoryClient\"", "from \"./directoryClient.mjs\""));
    const { CompanyHealth } = await import(pathToFileURL(componentPath).href);
    const row = { id: 42, organisation_name: '023 LTD', city_town: 'Edinburgh', county_region: 'Scotland' };
    const match = { number:'SC699219', name:'023 LTD', status:'active', address:'Edinburgh, United Kingdom' };
    const details = { ...match, established:'2021-05-19', sicCodes:[], charges:null, fetchedAt:'2026-10-30T00:00:00Z', registeredOffice:'25-29 Clerk Street, Edinburgh, United Kingdom', recordUrl:'https://find-and-update.company-information.service.gov.uk/company/SC699219' };
    let calls = [];
    globalThis.fetch = async url => { calls.push(String(url)); return { ok:true, json:async() => calls.length === 1 ? { items:[match], truncated:false } : details }; };
    let view;
    await act(async () => { view = create(React.createElement(CompanyHealth, { sponsor:row, onClose:()=>{} })); });
    assert.deepEqual(calls, ['/api/company-health?sponsor=42', '/api/company-health?sponsor=42&number=SC699219']);
    let rendered = JSON.stringify(view.toJSON());
    assert.match(rendered,/023 LTD/); assert.match(rendered,/Edinburgh/); assert.match(rendered,/Scotland/);
    assert.match(rendered,/25-29 Clerk Street/); assert.match(rendered,/do not prove/);
    assert.equal(view.root.findAllByType('input').length,0);
    await act(async () => view.unmount());

    // A bounded search with one match must not silently imply it is unique.
    calls=[];
    globalThis.fetch = async url => { calls.push(String(url)); return { ok:true, json:async()=>({items:[match],truncated:true}) }; };
    await act(async () => { view = create(React.createElement(CompanyHealth, { sponsor:row, onClose:()=>{} })); });
    rendered = JSON.stringify(view.toJSON());
    assert.equal(calls.length,1); assert.match(rendered,/other matches may exist/); assert.match(rendered,/SC699219/);
    await act(async () => view.unmount());

    globalThis.fetch = async () => ({ ok:true, json:async()=>({items:[],truncated:false}) });
    await act(async () => { view = create(React.createElement(CompanyHealth, { sponsor:row, onClose:()=>{} })); });
    rendered = JSON.stringify(view.toJSON());
    assert.match(rendered,/registered office can differ/); assert.match(rendered,/does not mean the employer is illegitimate/);
    await act(async () => view.unmount());

    const directory = await readFile('src/SponsorDirectory.tsx','utf8');
    assert.match(directory,/setHealthRow\(row\)/);
    assert.match(directory,/<CompanyHealth sponsor=\{healthRow\}/);
  } finally { globalThis.fetch = originalFetch; await rm(temp,{recursive:true,force:true}); }
});
