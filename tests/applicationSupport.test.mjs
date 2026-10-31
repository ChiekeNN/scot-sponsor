import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('personal support form is removed while historical inbox and retention remain',async()=>{
 const detail=await readFile('src/JobDetails.tsx','utf8');const feed=await readFile('src/PartnerJobs.tsx','utf8');const plans=await readFile('src/plans.ts','utf8');const admin=await readFile('src/AdminApplications.tsx','utf8');const privacy=await readFile('supabase/migrations/20261031201500_application_support.sql','utf8');
 assert.doesNotMatch(detail,/ApplicationSupport|request_application_support_for_job/);assert.doesNotMatch(feed,/request personal application support|Requests go to ScotSponsor/i);assert.doesNotMatch(plans,/request personalised application support/i);assert.match(admin,/admin_application_support_requests_v2/);assert.match(privacy,/90 days/);
});
