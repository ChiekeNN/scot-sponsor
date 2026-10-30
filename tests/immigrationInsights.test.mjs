import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseOccupationTables,searchOccupations,extractUpdates} from '../lib/gov-insights.js';
import {makeImmigrationHandler} from '../api/immigration.js';
import {readFile} from 'node:fs/promises';
const header = '<th scope="col">Occupation code</th><th scope="col">Job type</th><th scope="col">Related job titles</th>';
const occRows=Array.from({length:12},(_,i)=>`<tr><th scope="row">${1111+i}</th><td>${i===0?'Chief executives':'Occupation '+i}</td><td>Manager<br>Director ${i}</td><td>${i===0?'Higher Skilled':'Ineligible'}</td></tr>`).join('');
const rateRows=Array.from({length:11},(_,i)=>`<tr><th>${1111+i}</th><td>Occupation</td><td>Manager</td><td>£88,100<br>(£45.18 per hour)</td><td>£60,000<br>(£30.77 per hour)</td></tr>`).join('');
const occupations=`<table><thead><tr>${header}<th>Eligible for Skilled Worker as Higher Skilled, Medium Skilled or Ineligible</th></tr></thead><tbody>${occRows}</tbody></table>`;
const rates=`<table><thead><tr>${header}<th>Standard going rate</th><th>Lower going rate</th></tr></thead><tbody>${rateRows}</tbody></table>`;
test('parses official table shape, searches codes and titles, shows published rates without deciding eligibility',()=>{
 const rows=parseOccupationTables(occupations,rates); assert.equal(rows.length,12); assert.equal(rows[0].code,'1111'); assert.equal(rows[0].rates.standard,'£88,100 (£45.18 per hour)'); assert.equal(rows[11].rates,null); assert.equal(searchOccupations(rows,'chief executive').items[0].code,'1111'); assert.equal(searchOccupations(rows,'1112').items[0].category,'Ineligible'); assert.equal(searchOccupations(rows,'nonexistent').total,0);
});
test('refuses changed or incomplete tables instead of inventing salary data',()=>{
 assert.throws(()=>parseOccupationTables(occupations.replace('Eligible for Skilled Worker','Unknown'),rates),/format changed/);
 assert.throws(()=>parseOccupationTables(occupations,rates.replace('Standard going rate','Other rate')),/format changed/);
 assert.throws(()=>parseOccupationTables(occupations,rates.replace(rateRows,rateRows.slice(0,100))),/Incomplete|format/);
});
test('updates are official change notes sorted by publication date, not effective date',()=>{
 const rows=extractUpdates([{config:{title:'Rules',path:'/guidance/immigration-rules',filter:/skilled worker/i},data:{details:{change_history:[{note:'Unrelated change',public_timestamp:'2026-10-30T00:00:00Z'},{note:'Updated <b>Skilled Worker</b> rules.',public_timestamp:'2026-10-29T00:00:00Z'},{note:'Skilled Worker note',public_timestamp:'2026-09-01T00:00:00Z'}]}}}]); assert.equal(rows.length,2); assert.equal(rows[0].note,'Updated Skilled Worker rules.'); assert.equal(rows[0].published,'2026-10-29T00:00:00Z'); assert.match(rows[0].url,/gov.uk/);
});
function response(){return {headers:{},setHeader(k,v){this.headers[k]=v},end(s){this.body=JSON.parse(s)}}}
function client(allowed=true,valid=true){return ()=>({auth:{getUser:async()=>valid?{data:{user:{id:'user'}}}:{error:true}},rpc:async name=>{assert.equal(name,'can_access_member_insights');return {data:allowed}}})}
const fakeFetch=async url=>({ok:true,text:async()=>url.includes('going-rates')?rates:occupations,json:async()=>({public_updated_at:'2025-07-22T08:00:02Z',details:{change_history:[]}})});
test('API validates a real session and current member access before fetching sources',async()=>{
 let r=response(); await makeImmigrationHandler({create:client(),request:fakeFetch})({method:'GET',url:'/?kind=occupation&q=1111',headers:{}},r); assert.equal(r.statusCode,401);
 r=response(); await makeImmigrationHandler({create:client(false),request:()=>{throw Error('should not fetch')}})({method:'GET',url:'/?kind=occupation&q=1111',headers:{authorization:'Bearer token'}},r); assert.equal(r.statusCode,403);
 r=response(); await makeImmigrationHandler({create:client(),request:fakeFetch})({method:'GET',url:'/?kind=occupation&q=1111',headers:{authorization:'Bearer token'}},r); assert.equal(r.statusCode,200); assert.equal(r.body.items[0].rates.standard,'£88,100 (£45.18 per hour)'); assert.equal(r.body.sourceUpdated[0],'2025-07-22T08:00:02Z');
});
test('API fails closed if official source is unavailable or changes format',async()=>{
 const handler=makeImmigrationHandler({create:client(),request:async()=>({ok:true,text:async()=>'<html>bad</html>'})});const r=response();await handler({method:'GET',url:'/?kind=occupation&q=nurse',headers:{authorization:'Bearer token'}},r);assert.equal(r.statusCode,502);assert.match(r.body.error,/GOV.UK/);
});
test('member access applies expiry, revocation and administrator checks without changing directory access',async()=>{
 const sql=await readFile('supabase/migrations/20261030224000_member_insights_access.sql','utf8');assert.match(sql,/monthly_alert_pass/);assert.match(sql,/job_hunt_pass/);assert.match(sql,/expires_at > now\(\)/);assert.match(sql,/revoked_at is null/);assert.match(sql,/is_super_admin/);assert.match(sql,/from public, anon/);assert.doesNotMatch(sql,/alter policy/);
});
