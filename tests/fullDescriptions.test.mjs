import {test} from 'node:test';
import assert from 'node:assert/strict';
import {descriptionBlocks} from '../src/jobDescription.mjs';
test('description formatting preserves supplied headings, paragraphs and bullet content',()=>{
 const result=descriptionBlocks('Summary\nSupport warehouse operations.\n\nKey Responsibilities\n- Keep accurate records.\n- Coordinate goods movements.');assert.deepEqual(result,[{type:'heading',text:'Summary'},{type:'paragraph',text:'Support warehouse operations.'},{type:'heading',text:'Key Responsibilities'},{type:'list',items:['Keep accurate records.','Coordinate goods movements.']}]);
 const more=descriptionBlocks('**Preferred** **Qualifications**\n- Relevant experience.\n\nPay Range: £23–26/hour\nEqual opportunity.');assert.deepEqual(more,[{type:'heading',text:'**Preferred** **Qualifications**'},{type:'list',items:['Relevant experience.']},{type:'paragraph',text:'Pay Range: £23–26/hour\nEqual opportunity.'}]);
});
