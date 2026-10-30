import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = await readFile(new URL('../src/cvUtils.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { blankCv, cvToText, analyseKeywords } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('a blank CV is empty and exports no empty headings', () => {
  assert.equal(cvToText(blankCv()), '');
});
test('exports contact, skills and multiple entries in a readable order', () => {
  const cv = { ...blankCv(), name: 'A. Candidate', email: 'a@example.com', skills: 'SQL, Excel', experience: [{ id:'1', role:'Analyst', company:'Example', dates:'2024–2025', details:'Built reports' }, { id:'2', role:'Volunteer', company:'Charity', dates:'2023', details:'Helped people' }], education: [{id:'3', qualification:'MSc', institution:'University', dates:'2022', details:''}] };
  const text = cvToText(cv);
  assert.match(text, /^A\. Candidate\na@example.com/);
  assert.match(text, /SKILLS\nSQL, Excel/);
  assert.match(text, /Analyst — Example\n2024–2025\nBuilt reports/);
  assert.match(text, /Volunteer — Charity/);
  assert.match(text, /EDUCATION\nMSc — University/);
  assert.doesNotMatch(text, /PROFESSIONAL SUMMARY/);
});
test('keyword matching is case-insensitive and matches whole tokens', () => {
  const result = analyseKeywords('Experience with SQL, C++ and Excel', 'SQL sql C++ Excel Python analysis');
  assert.deepEqual(result.matched, ['sql', 'c++', 'excel']);
  assert.deepEqual(result.missing, ['analysis', 'python']);
  assert.equal(result.coverage, 60);
  assert.deepEqual(analyseKeywords('JavaScript', 'Java').matched, []);
});
test('empty or common-only descriptions have no fabricated score', () => {
  assert.equal(analyseKeywords('SQL', 'The role and the company').coverage, null);
  assert.equal(analyseKeywords('', '').coverage, null);
});
test('keyword comparison is limited to twenty selected terms', () => {
  const job = Array.from({length: 30}, (_, i) => `skill${i}`).join(' ');
  assert.equal(analyseKeywords('', job).terms.length, 20);
});
