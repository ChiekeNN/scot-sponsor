// Imports an independently supplied, authorised JSON array. It never fetches or scrapes job pages.
import {readFile,stat} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {validateFullRecords,importFullRecords} from '../lib/adzuna-full-import.js';
const args=process.argv.slice(2), file=args[0],apply=args.includes('--apply');
if(!file||args.some((arg,index)=>index>0&&arg!=='--apply')){console.error('Usage: node scripts/import-full-job-descriptions.mjs <private-json-file> [--apply]');process.exit(1)}
try{
 if((await stat(file)).size>64*1024*1024)throw Error('INPUT_TOO_LARGE');
 const records=validateFullRecords(JSON.parse(await readFile(file,'utf8')));
 if(!process.env.SUPABASE_SERVICE_ROLE_KEY||process.env.SUPABASE_URL?.replace(/\/$/,'')!=='https://ybsbeyyiwnhihkodbedv.supabase.co')throw Error('NOT_CONFIGURED');
 const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const summary=await importFullRecords(records,client,{apply});console.log(JSON.stringify({mode:apply?'apply':'dry-run',...summary}));
 if(summary.failed)process.exitCode=1;
}catch(error){console.error(`Import failed: ${['INPUT_TOO_LARGE','NOT_CONFIGURED','INVALID_INPUT','INVALID_RECORD','INVALID_DATE','INVALID_DESCRIPTION','LOOKUP_FAILED'].includes(error?.message)?error.message:'INVALID_FILE_OR_CONNECTION'}`);process.exitCode=1}
