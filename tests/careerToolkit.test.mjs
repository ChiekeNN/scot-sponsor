import {test} from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseDate,weekStart,weeklyHours,checkedPeriod,fiveYearAnniversary,encryptEvidence,decryptEvidence} from '../src/careerToolkit.mjs';
globalThis.crypto ??= webcrypto;
test('dates are valid and work weeks run Monday through Sunday across years',()=>{
 assert.equal(parseDate('2026-02-29'),null);assert.equal(weekStart('2027-01-03'),'2026-12-28');assert.equal(weekStart('2027-01-04'),'2027-01-04');
 assert.equal(weeklyHours([{date:'2026-12-28',hours:7},{date:'2027-01-03',hours:4.5},{date:'2027-01-04',hours:6}], '2027-01-02'),11.5);
 assert.equal(weeklyHours([], 'bad'),null);assert.equal(checkedPeriod('2026-10-31','2026-09-01','2026-12-01'),'within');assert.equal(checkedPeriod('2026-10-31','2026-12-01','2026-09-01'),'unknown');
});
test('five year date is only a calendar illustration, including leap day',()=>{
 assert.equal(fiveYearAnniversary('2024-02-29'),'2029-02-28');assert.equal(fiveYearAnniversary('bad'),null);
});
test('evidence round trips, hides content and metadata, and rejects wrong passphrase and tampering',async()=>{
 const password='a long passphrase';const input={name:'private document.txt',type:'text/plain',bytes:new TextEncoder().encode('very sensitive evidence')};
 const a=await encryptEvidence(input,password),b=await encryptEvidence(input,password);
 assert.notEqual(a,b);assert.ok(!a.includes(input.name));assert.ok(!a.includes('very sensitive evidence'));
 const opened=await decryptEvidence(a,password);assert.equal(opened.name,input.name);assert.deepEqual(opened.bytes,input.bytes);
 await assert.rejects(decryptEvidence(a,'wrong password'));const altered=JSON.parse(a);altered.ciphertext=(altered.ciphertext[0]==='A'?'B':'A')+altered.ciphertext.slice(1);await assert.rejects(decryptEvidence(JSON.stringify(altered),password));
 await assert.rejects(encryptEvidence(input,'short'));await assert.rejects(encryptEvidence({...input,bytes:new Uint8Array(2*1024*1024+1)},password));
});
test('new planning tools remain within member workspace and journal articles are public',async()=>{
 const app=await readFile(new URL('../src/App.tsx',import.meta.url),'utf8');const features=await readFile(new URL('../src/Features.tsx',import.meta.url),'utf8');const landing=await readFile(new URL('../src/Landing.tsx',import.meta.url),'utf8');
 assert.match(app,/!showLanding && hasMemberAccess/);assert.match(features,/<CareerToolkit key=\{userId\}/);assert.match(landing,/<Journal/);
});
