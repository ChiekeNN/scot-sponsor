import {timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {collectSource} from '../../lib/partner-jobs.js';
const send=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))};
export function makeSyncHandler({env=process.env,request=fetch,create=createClient}={}){return async(req,res)=>{
 if(req.method!=='GET'&&req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 const supplied=/^Bearer\s+(.+)$/i.exec(req.headers.authorization||'')?.[1];
 if(req.method==='GET'){
  const expected=env.CRON_SECRET;
  if(!expected||!supplied||Buffer.byteLength(expected)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))return send(res,401,{error:'Unauthorised'});
  if(Date.now()<Date.parse('2026-11-02T00:00:00Z') && req.headers['x-initial-sync']!=='1')return send(res,200,{message:'Scheduled sync begins next week.'});
 }else{
  if(!supplied)return send(res,401,{error:'Sign in to continue.'});
  try{
   const auth=create(env.VITE_SUPABASE_URL||'https://ybsbeyyiwnhihkodbedv.supabase.co',env.VITE_SUPABASE_ANON_KEY||'sb_publishable_2Cgs8BfrmrcqZcUVYprShg_DPpQgD2P',{global:{headers:{Authorization:`Bearer ${supplied}`}},auth:{persistSession:false,autoRefreshToken:false}});
   const user=await auth.auth.getUser(supplied);if(user.error||!user.data?.user)return send(res,401,{error:'Sign in to continue.'});
   const admin=await auth.rpc('is_super_admin');if(admin.error)return send(res,503,{error:'Could not verify admin access.'});if(!admin.data)return send(res,403,{error:'Super-admin access required.'});
  }catch{return send(res,503,{error:'Could not verify admin access.'})}
 }
 if(!env.SUPABASE_SERVICE_ROLE_KEY)return send(res,503,{error:'Job sync is not configured on the server.'});
 const client=create(env.VITE_SUPABASE_URL||'https://ybsbeyyiwnhihkodbedv.supabase.co',env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
 const reserved=await client.rpc('reserve_partner_job_sync');
 if(reserved.error)return send(res,503,{error:'Could not start the sync.'});
 if(!reserved.data)return send(res,429,{error:'A sync was started recently. Please wait two minutes.'});
 const status={};
 for(const source of ['reed'])try{
  const {jobs,truncated}=await collectSource(source,{request,env});
  const now=new Date().toISOString();
  for(let i=0;i<jobs.length;i+=250){const result=await client.from('partner_jobs').upsert(jobs.slice(i,i+250).map(j=>({...j,last_seen:now})),{onConflict:'source,external_id'});if(result.error)throw Error('SAVE_FAILED')}
  const saved=await client.from('partner_job_sync_status').upsert({source,last_success:now,last_attempt:now,last_error:null,count:jobs.length,truncated},{onConflict:'source'});if(saved.error)throw Error('SAVE_FAILED');status[source]={ok:true,count:jobs.length,truncated};
 }catch(error){
  const code=error?.message==='NOT_CONFIGURED'?'NOT_CONFIGURED':'SYNC_FAILED';
  await client.from('partner_job_sync_status').update({last_attempt:new Date().toISOString(),last_error:code}).eq('source',source);
  status[source]={ok:false};
 }
 if(Object.values(status).some(s=>s.ok))await client.from('partner_jobs').delete().lt('posted_at',new Date(Date.now()-21*86400000).toISOString());
 return send(res,Object.values(status).every(s=>s.ok)?200:503,{feeds:Object.values(status)});
}}
export default makeSyncHandler();
