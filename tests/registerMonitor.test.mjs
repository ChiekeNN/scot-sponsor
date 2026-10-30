import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { buildRegisterSnapshot } from '../supabase/functions/register-monitor/core.mjs';
const csv = 'Organisation Name,Town/City,County,Type & Rating,Route\n"Example, Ltd",Edinburgh,Scotland,Worker (A rating),Skilled Worker\n"Example, Ltd",Edinburgh,,Worker (A rating),Scale-up\n"Example, Ltd",Glasgow,Scotland,Worker (A rating),Skilled Worker\nExample Other,Edinburgh,Scotland,Worker (B rating),Skilled Worker\n';
const sponsors = [{id:1,name:' Example, LTD ',town:'EDINBURGH'}, {id:2,name:'Example Other',town:'Edinburgh'}, {id:3,name:'Missing',town:'Dundee'}];
test('register monitor matches exact name and town, handles quoted names, and records routes and ratings', () => {
 const rows=buildRegisterSnapshot(sponsors,csv,parse,1);
 assert.equal(rows.length,3);
 assert.equal(rows[0].entries.length,2);
 assert.deepEqual(rows[1].entries,[{county:'Scotland',rating:'Worker (B rating)',route:'Skilled Worker'}]);
 assert.deepEqual(rows[2].entries,[]);
 assert.equal(rows[0].entries.some(e=>e.route==='Scale-up'),true);
 assert.equal(rows[0].entries.filter(e=>e.route==='Skilled Worker').length,1);
});
test('monitor refuses incomplete or unexpected data rather than fabricating missing sponsors', () => {
 assert.throws(()=>buildRegisterSnapshot(sponsors,csv,parse,10),/Incomplete register/);
 assert.throws(()=>buildRegisterSnapshot(sponsors,csv.replace('Type & Rating','Wrong heading'),parse,1),/Unexpected register columns/);
 assert.throws(()=>buildRegisterSnapshot(sponsors,csv.replace('Worker (B rating)',''),parse,1),/Incomplete register data/);
 assert.throws(()=>buildRegisterSnapshot([{id:4,name:'Unrelated',town:'Perth'}],csv,parse,1),/matched too few/);
});
test('snapshot comparison, feed and mark-read are protected server-side', async () => {
 const sql=await readFile('supabase/migrations/20261030220000_admin_register_monitor.sql','utf8');
 assert.match(sql,/if not public\.is_super_admin\(\) then raise exception 'Not authorised'/i);
 assert.match(sql,/revoke all on function public\.register_monitor_apply\(uuid,text,timestamptz,jsonb\) from public, anon, authenticated/i);
 assert.match(sql,/previous_version = p_version/i);
 assert.match(sql,/Unexpected drop in matched sponsors/i);
 assert.match(sql,/register_monitor_authorise\(text\) from public, anon, authenticated/i);
});
