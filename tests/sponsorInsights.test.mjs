import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = await readFile(new URL('../src/sponsorInsights.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { sponsorSnapshot } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('snapshot summary and complete industry counts match the supplied report', () => {
  assert.equal(sponsorSnapshot.sponsorRecords, 6458);
  assert.equal(sponsorSnapshot.uniqueOrganisations, 5853);
  assert.equal(sponsorSnapshot.towns, 397);
  assert.equal(sponsorSnapshot.categories, 13);
  assert.deepEqual(sponsorSnapshot.sectors.map(row => row.count), [3541, 630, 536, 351, 335, 314, 202, 168, 145, 128, 44, 44, 20]);
  assert.equal(sponsorSnapshot.sectors.reduce((sum, row) => sum + row.count, 0), sponsorSnapshot.sponsorRecords);
  assert.deepEqual(sponsorSnapshot.sectors.map(row => row.percent), [54.8, 9.8, 8.3, 5.4, 5.2, 4.9, 3.1, 2.6, 2.2, 2.0, 0.7, 0.7, 0.3]);
});
test('all top 15 locations and their rounded percentages match the supplied report', () => {
  assert.deepEqual(sponsorSnapshot.locations.map(row => [row.name, row.count, row.percent]), [
    ['Glasgow', 1522, 23.6], ['Edinburgh', 1319, 20.4], ['Aberdeen', 619, 9.6], ['Dundee', 193, 3.0],
    ['Livingston', 104, 1.6], ['Inverness', 96, 1.5], ['Paisley', 87, 1.3], ['Perth', 86, 1.3],
    ['Stirling', 79, 1.2], ['Dunfermline', 77, 1.2], ['Falkirk', 64, 1.0], ['Motherwell', 61, 0.9],
    ['Dumfries', 53, 0.8], ['Kirkcaldy', 52, 0.8], ['Westhill', 51, 0.8],
  ]);
});
