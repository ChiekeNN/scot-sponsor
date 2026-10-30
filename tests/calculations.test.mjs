import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = await readFile(new URL('../src/calculations.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { estimateScottishPay } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
const round = value => Math.round(value * 100) / 100;

test('zero and negative income do not produce negative tax', () => {
  assert.equal(estimateScottishPay(0).net, 0);
  assert.equal(estimateScottishPay(-500).net, 0);
});
test('2026–27 Scottish bands and employee NI at £38,000', () => {
  const result = estimateScottishPay(38000);
  assert.equal(round(result.incomeTax), 5131.07);
  assert.equal(round(result.nationalInsurance), 2034.40);
  assert.equal(round(result.net), 30834.53);
});
test('personal allowance tapers above £100,000', () => {
  assert.equal(estimateScottishPay(100000).allowance, 12570);
  assert.equal(estimateScottishPay(110000).allowance, 7570);
  assert.equal(estimateScottishPay(125140).allowance, 0);
});
test('NI switches to 2% above the upper earnings limit', () => {
  assert.equal(round(estimateScottishPay(51270).nationalInsurance - estimateScottishPay(50270).nationalInsurance), 20);
});
