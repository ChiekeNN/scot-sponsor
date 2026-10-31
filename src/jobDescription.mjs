// Format only text already supplied by the listing; do not infer or invent sections.
const headingNames=new Set(['summary','overview','about the role','about this role','about the job','job description','key responsibilities','responsibilities','duties','key duties','requirements','qualifications','basic qualifications','preferred qualifications','education and experience','education','experience','benefits','why join us','what we offer','about us']);
const unbold=s=>s.replace(/\*\*([^*\n]+)\*\*/g,'$1');
export function descriptionBlocks(value){
 const lines=String(value||'').replace(/\r\n?/g,'\n').split('\n');const blocks=[];let paragraph=[];let bullets=[];
 const flushParagraph=()=>{if(paragraph.length){blocks.push({type:'paragraph',text:paragraph.join('\n')});paragraph=[]}};
 const flushBullets=()=>{if(bullets.length){blocks.push({type:'list',items:bullets});bullets=[]}};
 for(const raw of lines){
  const line=raw.trim();if(!line){flushParagraph();flushBullets();continue}
  const bullet=/^(?:[-•]|\*)\s+(.+)$/.exec(line);if(bullet){flushParagraph();bullets.push(bullet[1]);continue}
  const heading=unbold(line).replace(/:$/,'').trim().toLowerCase();
  if(headingNames.has(heading)){flushParagraph();flushBullets();blocks.push({type:'heading',text:line});continue}
  flushBullets();paragraph.push(raw);
 }
 flushParagraph();flushBullets();return blocks;
}
