import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = await readFile(new URL('../src/guides.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { guides } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);

test('career guides have unique shareable slugs and substantive content', () => {
  assert.ok(guides.length >= 8);
  assert.equal(new Set(guides.map(guide => guide.slug)).size, guides.length);
  for (const guide of guides) {
    assert.match(guide.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(guide.title && guide.description && guide.intro && guide.takeaway);
    assert.ok(guide.sections.length >= 3);
    assert.ok(guide.sources.length > 0);
    for (const source of guide.sources) {
      assert.ok(source.label);
      assert.equal(new URL(source.url).protocol, 'https:');
    }
  }
});

test('guides cover the main job-search topics', () => {
  const categories = new Set(guides.map(guide => guide.category));
  for (const category of ['Job search', 'CV & applications', 'Interviews', 'Working in Scotland', 'Sponsorship']) assert.ok(categories.has(category));
});

test('immigration guides cite the official sources and state when checked', () => {
  const relationship = guides.find(g => g.slug === 'visa-when-a-relationship-ends');
  const sponsor = guides.find(g => g.slug === 'if-your-visa-sponsor-loses-licence');
  assert.equal(relationship.reviewed, '30 October 2026'); assert.equal(sponsor.reviewed, '30 October 2026');
  assert.ok(relationship.sources.some(s => s.url === 'https://www.gov.uk/visas-when-you-separate-or-divorce'));
  assert.ok(relationship.sources.some(s => s.url.startsWith('https://www.mygov.scot/')));
  assert.ok(sponsor.sources.some(s => s.url === 'https://www.gov.uk/employee-lose-sponsor-licence'));
  assert.match(relationship.sections.map(s=>s.body).join(' '), /999/);
  assert.match(sponsor.sections.map(s=>s.body).join(' '), /suspend/i);
});
