import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import writeExcelFile from 'write-excel-file/node';
import { unzipSync, strFromU8 } from 'fflate';
import { directorySheet, directoryAutoFilter, directoryColumns } from '../src/directoryWorkbook.mjs';

test('Excel export has six columns, native filters, frozen header and text-only cells', async () => {
  const rows = [{ id: 1, organisation_name: '=HYPERLINK("https://example.com")', city_town: 'Edinburgh', county_region: 'Scotland', industry_sector: 'Healthcare', visa_route: 'Skilled Worker', licence_rating: 'Worker (A rating)' }];
  const buffer = await writeExcelFile(directorySheet(rows), { sheet: 'Sponsor directory', columns: directoryColumns.map(col => ({ width: col.width })), stickyRowsCount: 1 }, { features: [directoryAutoFilter(rows.length)] }).toBuffer();
  const files = unzipSync(new Uint8Array(buffer));
  const xml = strFromU8(files['xl/worksheets/sheet1.xml']);
  assert.match(xml, /<autoFilter ref="A1:F2"\s*\/>/);
  assert.match(xml, /ySplit="1"/);
  assert.doesNotMatch(xml, /<f(?:\s|>)/);
  assert.equal(directoryColumns.length, 6);
  assert.equal(directorySheet(rows)[1][0].type, String);
  assert.equal(directorySheet(rows)[1][0].value, rows[0].organisation_name);
});

test('importer validates the CSV without credentials or publishing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'scot-directory-test-'));
  try {
    const csv = join(dir, 'fixture.csv');
    await writeFile(csv, 'Organisation Name,City / Town,County / Region,Industry Sector,Visa Route,Licence Type & Rating\n"Example, Ltd",Glasgow,Scotland,Technology,Skilled Worker,Worker (A rating)\n');
    const output = execFileSync(process.execPath, ['scripts/import-sponsor-directory.mjs', csv, '--validate-only'], { encoding: 'utf8' });
    assert.match(output, /Validated 1 records, 1 industries and 1 cities\/towns/);
    await writeFile(csv, 'wrong,columns\nvalue,value\n');
    assert.throws(() => execFileSync(process.execPath, ['scripts/import-sponsor-directory.mjs', csv, '--validate-only'], { stdio: 'pipe' }));
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('migration defaults to server-enforced active Job Hunt entitlement', async () => {
  const sql = await readFile(new URL('../supabase/migrations/20261030200130_sponsor_directory.sql', import.meta.url), 'utf8');
  assert.match(sql, /alter table public\.sponsor_directory enable row level security/i);
  assert.match(sql, /revoke all on public\.member_entitlements, public\.sponsor_directory_versions, public\.sponsor_directory from public, anon, authenticated/i);
  assert.match(sql, /e\.user_id = \(select auth\.uid\(\)\).*e\.plan = 'job_hunt_pass'/is);
  assert.match(sql, /e\.expires_at > now\(\) and e\.revoked_at is null/i);
  assert.match(sql, /revoke all on function public\.activate_sponsor_directory\(uuid\) from public, anon, authenticated/i);
});
