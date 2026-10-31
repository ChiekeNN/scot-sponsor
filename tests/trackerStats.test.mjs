import {test} from 'node:test';
import assert from 'node:assert/strict';
import {trackerStats} from '../src/trackerStats.mjs';
test('dashboard derives pipeline and due counts from current local records',()=>{
 const data=[{stage:'Interested',followUp:'2026-10-30'},{stage:'Applied',followUp:'2026-10-31'},{stage:'Interview',followUp:'2026-11-01'},{stage:'Offer',followUp:'2026-10-01'},{stage:'Closed',followUp:'2026-10-01'}];
 const result=trackerStats(data,'2026-10-31');assert.equal(result.total,5);assert.equal(result.due,2);assert.equal(result.inProgress,2);assert.deepEqual(Object.values(result.stages),[1,1,1,1,1]);
 data[1].stage='Closed';assert.equal(trackerStats(data,'2026-10-31').due,1);assert.equal(trackerStats([],'2026-10-31').total,0);
});
