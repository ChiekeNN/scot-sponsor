// Browser-only planning helpers. None of these calculations establish legal eligibility.
export function parseDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;
 const d=new Date(`${value}T00:00:00Z`);
 return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===value?d:null;
}
export function weekStart(value){
 const d=parseDate(value);if(!d)return null;
 d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10);
}
export function weeklyHours(rows, date){
 const start=weekStart(date);if(!start)return null;
 return rows.filter(r=>weekStart(r.date)===start&&Number.isFinite(r.hours)&&r.hours>=0).reduce((sum,r)=>sum+r.hours,0);
}
export function fiveYearAnniversary(value){
 const d=parseDate(value);if(!d)return null;
 const year=d.getUTCFullYear()+5,month=d.getUTCMonth(),day=d.getUTCDate();
 const last=new Date(0);last.setUTCFullYear(year,month+1,0);
 const result=new Date(0);result.setUTCFullYear(year,month,Math.min(day,last.getUTCDate()));
 return result.toISOString().slice(0,10);
}
export function checkedPeriod(date,start,end){
 if(!parseDate(date)||!parseDate(start)||!parseDate(end)||start>end)return 'unknown';
 return date>=start&&date<=end?'within':'outside';
}
const b64 = bytes => {let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary)};
const from64 = text => Uint8Array.from(atob(text), c=>c.charCodeAt(0));
async function keyFor(password,salt,uses){
 const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,uses);
}
export async function encryptEvidence({name,type,bytes},password){
 if(password.length<12)throw new Error('Use a passphrase of at least 12 characters.');
 if(!name||name.length>200||!(bytes instanceof Uint8Array)||bytes.length===0||bytes.length>2*1024*1024)throw new Error('Choose a file between 1 byte and 2 MB.');
 const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));
 const payload=JSON.stringify({name,type,createdAt:new Date().toISOString(),data:b64(bytes)});
 const cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await keyFor(password,salt,['encrypt']),new TextEncoder().encode(payload));
 return JSON.stringify({format:'scotsponsor-evidence-v1',salt:b64(salt),iv:b64(iv),ciphertext:b64(new Uint8Array(cipher))});
}
export async function decryptEvidence(packageText,password){
 if(typeof packageText!=='string'||packageText.length>4*1024*1024)throw new Error('Invalid encrypted file.');
 try{
  const data=JSON.parse(packageText);if(data.format!=='scotsponsor-evidence-v1')throw Error();
  const salt=from64(data.salt),iv=from64(data.iv),cipher=from64(data.ciphertext);
  if(salt.length!==16||iv.length!==12||cipher.length>3*1024*1024)throw Error();
  const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},await keyFor(password,salt,['decrypt']),cipher);
  const content=JSON.parse(new TextDecoder().decode(plain));
  if(typeof content.name!=='string'||!content.name||content.name.length>200||typeof content.type!=='string'||typeof content.data!=='string')throw Error();
  const bytes=from64(content.data);if(!bytes.length||bytes.length>2*1024*1024)throw Error();
  return {name:content.name.replace(/[\\/\x00-\x1f]/g,'_'),type:content.type,createdAt:content.createdAt,bytes};
 }catch{throw new Error('Unable to open the file. Check the passphrase and encrypted file.');}
}
