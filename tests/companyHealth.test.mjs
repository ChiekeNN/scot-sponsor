import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeCompanyHealthHandler } from '../api/company-health.js';
import { matchesSponsor } from '../lib/company-match.js';

const sponsor = { organisation_name: '023 LTD', city_town: 'Edinburgh', county_region: 'Scotland' };
const office = { address_line_1: '25-29 Clerk Street', locality: 'Edinburgh', postal_code: 'EH8 9JH', country: 'United Kingdom' };
const company = (overrides = {}) => ({ company_number: 'SC699219', title: '023 LTD', company_status: 'active', address: office, ...overrides });
const profile = (overrides = {}) => ({ company_number: 'SC699219', company_name: '023 LTD', company_status: 'active', date_of_creation: '2021-05-19', registered_office_address: office, sic_codes: ['47810'], has_charges: true, ...overrides });
const client = ({ user = true, pass = true, row = sponsor, rowError = null } = {}) => () => ({
  auth: { getUser: async () => ({ data: { user: user ? {} : null }, error: null }) },
  rpc: async name => { assert.equal(name, 'can_access_job_hunt'); return { data: pass, error: null }; },
  from: table => { assert.equal(table, 'sponsor_directory'); return { select: columns => { assert.equal(columns, 'organisation_name,city_town,county_region'); return { eq: (column, value) => { assert.equal(column, 'id'); assert.match(value, /^[1-9][0-9]*$/); return { maybeSingle: async () => ({ data: row, error: rowError }) }; } }; } }; },
});
const run = async (handler, url = '/?sponsor=123', token = 'test-token') => { const result = { headers: {}, setHeader(k,v) { this.headers[k]=v; }, end(v) { this.body=JSON.parse(v); } }; await handler({ method:'GET', url, headers: token ? { authorization:`Bearer ${token}` } : {} }, result); return result; };
const ok = body => ({ ok: true, status: 200, json: async () => body });

test('company health denies unauthenticated and non-entitled users before querying Companies House', async () => {
 let requests=0; const request=async()=>{requests++; throw new Error('should not call upstream');};
 let handler=makeCompanyHealthHandler({create:client(),request,apiKey:'dummy'});
 assert.equal((await run(handler,'/?sponsor=123',null)).statusCode,401);
 handler=makeCompanyHealthHandler({create:client({user:false}),request,apiKey:'dummy'});
 assert.equal((await run(handler)).statusCode,401);
 handler=makeCompanyHealthHandler({create:client({pass:false}),request,apiKey:'dummy'});
 assert.equal((await run(handler)).statusCode,403);
 assert.equal(requests,0);
});

test('uses only the selected, RLS-protected directory record and rejects invalid or unavailable IDs', async () => {
 let calls=0;
 const request = async () => { calls++; return ok({items: []}); };
 const handler=makeCompanyHealthHandler({create:client(),request,apiKey:'dummy'});
 assert.equal((await run(handler,'/?search=023%20LTD')).statusCode,400);
 assert.equal((await run(handler,'/?sponsor=../../x')).statusCode,400);
 assert.equal((await run(handler,'/?sponsor=123&number=../../x')).statusCode,400);
 assert.equal((await run(makeCompanyHealthHandler({create:client({row:null}),request,apiKey:'dummy'}))).statusCode,404);
 assert.equal((await run(makeCompanyHealthHandler({create:client({rowError:{message:'RLS error'}}),request,apiKey:'dummy'}))).statusCode,503);
 assert.equal(calls,0);
});

test('matches exact names and Scottish offices without guessing from snippets or substrings', () => {
 assert.equal(matchesSponsor(company(), sponsor), true); // UK country, Scottish company number
 assert.equal(matchesSponsor(company({title:'  023   ltd ', address:{...office, locality:' EDINBURGH ', country:''}}), sponsor), true);
 for (const candidate of [
   company({title:'023 LTD SERVICES'}), company({title:'023 LTD.'}),
   company({address:{...office, locality:'Glasgow'}}),
   company({address:{...office, locality:'Edinburghshire'}}),
   company({address:{...office, locality:'Glasgow', address_line_2:'Edinburgh'}}),
   company({address:{...office, region:'England'}}),
   company({address:{...office, country:'England'}}),
   company({address:{...office, country:'United States'}}),
   company({address:{country:'Scotland'}, address_snippet:'Edinburgh, Scotland'}),
   company({company_number:'12345678'}), // UK is not Scotland by itself
   company({address:null}),
 ]) assert.equal(matchesSponsor(candidate, sponsor), false, JSON.stringify(candidate));
 assert.equal(matchesSponsor(company({company_number:'12345678',address:{...office,country:'Scotland'}}), sponsor), true);
 assert.equal(matchesSponsor(company({address:{address_line_2:'Edinburgh',country:'Scotland'}}), sponsor), true);
 assert.equal(matchesSponsor(company(), {...sponsor,city_town:''}), false);
 const countySponsor = {...sponsor, county_region:'Midlothian'};
 assert.equal(matchesSponsor(company({address:{...office,region:'Midlothian'}}), countySponsor), true);
 assert.equal(matchesSponsor(company(), countySponsor), false);
 assert.equal(matchesSponsor(company({address:{...office,region:'East Lothian'}}), countySponsor), false);
});

test('search returns only exact name and location matches, using the selected row, not caller search text', async () => {
 let seenUrl;
 const request = async url => { seenUrl = url; return ok({ total_results: 4, items: [company(), company({title:'023 OTHER LTD'}), company({address:{...office,locality:'Glasgow'}}), company({address_snippet:'Edinburgh',address:{country:'Scotland'}})] }); };
 const handler = makeCompanyHealthHandler({ create: client(), request, apiKey: 'dummy' });
 const result = await run(handler, '/?sponsor=123&search=unrelated');
 assert.equal(result.statusCode, 200);
 assert.equal(new URL(seenUrl).searchParams.get('q'), '023 LTD');
 assert.deepEqual(result.body.items, [{number:'SC699219',name:'023 LTD',status:'active',address:'25-29 Clerk Street, Edinburgh, EH8 9JH, United Kingdom'}]);
 assert.equal(result.body.truncated,false);
 assert.doesNotMatch(JSON.stringify(result.body), /023 OTHER LTD|Glasgow/);
 assert.equal(result.headers['Cache-Control'],'private, no-store');
});

test('encodes names and paginates with a bounded, honestly reported search', async () => {
 const row={...sponsor,organisation_name:'Example & Co'};
 const urls=[];
 const match=company({title:'Example & Co'});
 const request = async url => { urls.push(new URL(url)); return ok({total_results:10,items: [urls.length === 2 ? match : company({title:'Example & Co EXTRA'})]}); };
 const result = await run(makeCompanyHealthHandler({create:client({row}),request,apiKey:'dummy'}));
 assert.equal(result.statusCode,200);
 assert.equal(urls.length,5);
 assert.deepEqual(urls.map(u=>u.searchParams.get('start_index')),['0','1','2','3','4']);
 assert.equal(urls[0].searchParams.get('q'),'Example & Co');
 assert.match(urls[0].href,/Example%20%26%20Co/);
 assert.deepEqual(result.body.items.map(x=>x.name),['Example & Co']);
 assert.equal(result.body.truncated,true);
});

test('missing, inconsistent or truncated search responses are not falsely definitive', async () => {
 const noLocation = makeCompanyHealthHandler({create:client({row:{...sponsor,city_town:''}}),request:async()=>{throw Error('must not call');},apiKey:'dummy'});
 assert.deepEqual((await run(noLocation)).body,{items:[],truncated:false});
 assert.equal((await run(noLocation,'/?sponsor=123&number=SC699219')).statusCode,409);
 const incomplete = makeCompanyHealthHandler({create:client(),request:async()=>ok({total_results:5,items:[]}),apiKey:'dummy'});
 assert.equal((await run(incomplete)).body.truncated,true);
 const invalid = makeCompanyHealthHandler({create:client(),request:async()=>ok({}),apiKey:'dummy'});
 assert.equal((await run(invalid)).statusCode,502);
});

test('profile is revalidated against the selected row before charges or details are returned', async () => {
 let chargeRequests=0;
 const request=async url => { if(url.includes('/charges')) { chargeRequests++; return ok({total_count:3,items:[{status:'outstanding'},{status:'part-satisfied'},{status:'satisfied'}]}); } return ok(profile()); };
 const handler=makeCompanyHealthHandler({create:client(),request,apiKey:'dummy'});
 const result=await run(handler,'/?sponsor=123&number=SC699219');
 assert.equal(result.statusCode,200); assert.deepEqual(result.body.charges,{outstanding:1,partSatisfied:1});
 assert.equal(result.body.recordUrl,'https://find-and-update.company-information.service.gov.uk/company/SC699219');
 assert.match(result.body.registeredOffice,/Edinburgh/);
 assert.equal(chargeRequests,1);
 for (const changed of [profile({company_name:'WRONG LTD'}),profile({registered_office_address:{...office,locality:'Glasgow'}}),profile({company_number:'SC000000'})]) {
   let charged=false; const wrong=makeCompanyHealthHandler({create:client(),request:async url=>{ if(url.includes('/charges')) charged=true; return ok(changed); },apiKey:'dummy'});
   const rejected=await run(wrong,'/?sponsor=123&number=SC699219');
   assert.equal(rejected.statusCode,409); assert.equal(charged,false); assert.doesNotMatch(JSON.stringify(rejected.body),/WRONG LTD|Glasgow/);
 }
});

test('unavailable charges are not misreported as zero', async () => {
 const request = async url => url.includes('/charges') ? {ok:false,status:503} : ok(profile());
 const result=await run(makeCompanyHealthHandler({create:client(),request,apiKey:'dummy'}),'/?sponsor=123&number=SC699219');
 assert.equal(result.statusCode,200); assert.equal(result.body.charges,null);
});

test('Companies House authentication errors are identified without exposing keys or headers', async () => {
 const secret = 'example-key'; let sentAuth;
 const request = async (_url, opts) => { sentAuth = opts.headers.Authorization; return { ok: false, status: 401 }; };
 const result = await run(makeCompanyHealthHandler({ create: client(), request, apiKey: `  ${secret}\n` }));
 assert.equal(result.statusCode, 502); assert.equal(result.body.code, 'CH-401');
 assert.match(result.body.error, /rejected the connection/);
 assert.equal(sentAuth, `Basic ${Buffer.from(`${secret}:`).toString('base64')}`);
 assert.doesNotMatch(JSON.stringify(result.body), /example-key|Basic|Authorization/);
});

test('upstream failures and absent keys are clearly distinguishable', async () => {
 for (const [status, expected, code] of [[403,502,'CH-403'],[429,429,'CH-429'],[503,502,'CH-503'],[404,502,'CH-404']]) {
   const result = await run(makeCompanyHealthHandler({create:client(),request:async()=>({ok:false,status}),apiKey:'dummy'}));
   assert.equal(result.statusCode,expected); assert.equal(result.body.code,code);
 }
 const result = await run(makeCompanyHealthHandler({create:client(),request:async()=>{throw Error('must not call');},apiKey:' \n '}));
 assert.equal(result.statusCode,503); assert.equal(result.body.code,'CH-NOT-CONFIGURED');
});
