import {timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {fetchReedDetail} from '../../lib/reed-details.js';
const send=(res,status,body)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.end(JSON.stringify(body))};
export function makeDetailHandler({env=process.env,request=fetch,create=createClient,clock=()=>Date.now()}={}){return async(req,res)=>{
 if(req.method!=='GET'&&req.method!=='POST')return send(res,405,{error:'Method not allowed'});
 const token=/^Bearer\s+(.+)$/i.exec(req.headers.authorization||'')?.[1];
 if(req.method==='GET'){
  const secret=env.CRON_SECRET;
  if(!secret||!token||Buffer.byteLength(secret)!==Buffer.byteLength(token)||!timingSafeEqual(Buffer.from(secret),Buffer.from(token)))return send(res,401,{error:'Unauthorised'});
 }else{
  if(!token)return send(res,401,{error:'Sign in to continue.'});
  try{
   const auth=create(env.VITE_SUPABASE_URL||'https://ybsbeyyiwnhihkodbedv.supabase.co',env.VITE_SUPABASE_ANON_KEY||'sb_publishable_2Cgs8BfrmrcqZcUVYprShg_DPpQgD2P',{global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
   const user=await auth.auth.getUser(token);if(user.error||!user.data?.user)return send(res,401,{error:'Sign in to continue.'});
   const admin=await auth.rpc('is_super_admin');if(admin.error)return send(res,503,{error:'Could not verify admin access.'});if(!admin.data)return send(res,403,{error:'Super-admin access required.'});
  }catch{return send(res,503,{error:'Could not verify admin access.'})}
 }
 if(!env.SUPABASE_SERVICE_ROLE_KEY||!env.REED_API_KEY)return send(res,503,{error:'Full-description import is not configured on the server.'});
 try{
  const client=create(env.VITE_SUPABASE_URL||'https://ybsbeyyiwnhihkodbedv.supabase.co',env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
  const reserved=await client.rpc('reserve_partner_job_sync');if(reserved.error)return send(res,503,{error:'Could not start the import.'});if(!reserved.data)return send(res,429,{error:'A job sync or import started recently. Please wait two minutes.'});
  const claimed=await client.rpc('claim_reed_detail_jobs',{p_limit:30});if(claimed.error)return send(res,503,{error:claimed.error.message?.includes('PROVIDER_RATE_LIMITED')?'Full-description import is temporarily rate limited.':'Could not claim descriptions.'});if(!Array.isArray(claimed.data))return send(res,503,{error:'Could not claim descriptions.'});
  const summary={attempted:0,saved:0,expired:0,failed:0,remaining:claimed.data.length,rateLimited:false};const deadline=clock()+40000;
  for(const job of claimed.data){
   const available=deadline-clock();if(available<1000)break;
   summary.attempted++;summary.remaining--;
   try{
    const payload=await fetchReedDetail(job,{request,apiKey:env.REED_API_KEY,timeoutMs:Math.min(5000,available)});
    const result=await client.rpc('save_reed_job_detail',payload);if(result.error)throw Error('SAVE_FAILED');
    if(result.data==='saved')summary.saved++;else if(result.data==='expired')summary.expired++;else if(result.data!=='manual_preserved')summary.failed++;
   }catch(error){summary.failed++;if(error?.message==='RATE_LIMITED'){summary.rateLimited=true;const block=await client.rpc('block_reed_detail_import',{p_seconds:error.retrySeconds||1800});if(block.error)return send(res,503,{error:'Could not record the provider cooldown. Do not retry until the provider permits it.'});break}}
  }
  return send(res,summary.failed?503:200,summary);
 }catch{return send(res,503,{error:'Full-description import failed.'})}
}}
export default makeDetailHandler();
