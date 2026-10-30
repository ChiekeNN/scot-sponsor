import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCompanyHealthHandler } from '../api/company-health.js';

const client = ({ user = true, pass = true } = {}) => () => ({ auth: { getUser: async () => ({ data: { user: user ? {} : null }, error: null }) }, rpc: async (name) => { assert.equal(name, 'can_access_job_hunt'); return { data: pass, error: null }; } });
const run = async (handler, url, token = 'test-token') => { const result = { headers: {}, setHeader(k,v) { this.headers[k]=v; }, end(v) { this.body=JSON.parse(v); } }; await handler({ method:'GET', url, headers: token ? { authorization:`Bearer ${token}` } : {} }, result); return result; };

test('company health is denied without a session or an active Job Hunt Pass', async () => {
 let requests=0; const request=async()=>{requests++; throw new Error('should not call upstream');};
 let handler=makeCompanyHealthHandler({create:client(),request,apiKey:'dummy'});
 assert.equal((await run(handler,'/?search=test',null)).statusCode,401);
 handler=makeCompanyHealthHandler({create:client({user:false}),request,apiKey:'dummy'});
 assert.equal((await run(handler,'/?search=test')).statusCode,401);
 handler=makeCompanyHealthHandler({create:client({pass:false}),request,apiKey:'dummy'});
 assert.equal((await run(handler,'/?search=test')).statusCode,403);
 assert.equal(requests,0);
});

test('company data comes from an authorised account and explicit company number, and charges are counted by status', async () => {
 const request = async url => ({ok:true,status:200,json:async()=>url.includes('/charges') ? { total_count:3, items:[{status:'outstanding'},{status:'part-satisfied'},{status:'satisfied'}] } : { company_number:'SC123456', company_name:'EXAMPLE LTD', company_status:'active', date_of_creation:'2010-01-01', sic_codes:['62020'], has_charges:true }});
 const handler=makeCompanyHealthHandler({create:client(),request,apiKey:'dummy'});
 const result=await run(handler,'/?number=SC123456');
 assert.equal(result.statusCode,200); assert.deepEqual(result.body.charges,{outstanding:1,partSatisfied:1});
 assert.equal(result.body.recordUrl,'https://find-and-update.company-information.service.gov.uk/company/SC123456');
 assert.equal(result.headers['Cache-Control'],'private, no-store');
 assert.equal((await run(handler,'/?number=../../x')).statusCode,400);
});

test('unavailable charges are not misreported as zero', async () => {
 const request = async url => url.includes('/charges') ? {ok:false,status:503} : {ok:true,status:200,json:async()=>({company_number:'12345678',company_name:'Example',has_charges:true})};
 const result=await run(makeCompanyHealthHandler({create:client(),request,apiKey:'dummy'}),'/?number=12345678');
 assert.equal(result.statusCode,200); assert.equal(result.body.charges,null);
});

test('Companies House authentication errors are identified without exposing keys or headers', async () => {
 const secret = 'example-key'; let sentAuth;
 const request = async (_url, opts) => { sentAuth = opts.headers.Authorization; return { ok: false, status: 401 }; };
 const handler = makeCompanyHealthHandler({ create: client(), request, apiKey: `  ${secret}\n` });
 const result = await run(handler, '/?search=Edinburgh');
 assert.equal(result.statusCode, 502);
 assert.equal(result.body.code, 'CH-401');
 assert.match(result.body.error, /rejected the connection/);
 assert.equal(sentAuth, `Basic ${Buffer.from(`${secret}:`).toString('base64')}`);
 assert.doesNotMatch(JSON.stringify(result.body), /example-key|Basic|Authorization/);
});

test('upstream failures and absent keys are clearly distinguishable', async () => {
 for (const [status, expected, code] of [[403, 502, 'CH-403'], [429, 429, 'CH-429'], [503, 502, 'CH-503'], [404, 502, 'CH-404']]) {
   const handler = makeCompanyHealthHandler({ create: client(), request: async () => ({ ok: false, status }), apiKey: 'dummy' });
   const result = await run(handler, '/?search=Glasgow');
   assert.equal(result.statusCode, expected); assert.equal(result.body.code, code);
 }
 const noKey = makeCompanyHealthHandler({ create: client(), request: async () => { throw new Error('must not call'); }, apiKey: ' \n ' });
 const result = await run(noKey, '/?search=Glasgow');
 assert.equal(result.statusCode, 503); assert.equal(result.body.code, 'CH-NOT-CONFIGURED');
});

test('search returns Companies House matches using an encoded name', async () => {
 let seenUrl;
 const request = async url => { seenUrl = url; return { ok: true, status: 200, json: async () => ({ items: [{ company_number: 'SC123456', title: 'Example & Co', company_status: 'active', address_snippet: 'Edinburgh' }] }) }; };
 const handler = makeCompanyHealthHandler({ create: client(), request, apiKey: 'dummy' });
 const result = await run(handler, '/?search=Example%20%26%20Co');
 assert.equal(result.statusCode, 200);
 assert.match(seenUrl, /q=Example%20%26%20Co/);
 assert.deepEqual(result.body.items, [{ number: 'SC123456', name: 'Example & Co', status: 'active', address: 'Edinburgh' }]);
});
