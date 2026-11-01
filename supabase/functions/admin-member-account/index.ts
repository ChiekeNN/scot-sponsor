import {createClient} from 'npm:@supabase/supabase-js@2';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const response=(status:number,body:Record<string,unknown>)=>Response.json(body,{status,headers:{...cors,'Cache-Control':'no-store'}});
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return response(405,{error:'METHOD_NOT_ALLOWED'});
 const authorization=req.headers.get('Authorization')||'';
 if(!/^Bearer\s+\S+$/i.test(authorization))return response(401,{error:'NOT_AUTHORISED'});
 const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!anon||!secret)return response(503,{error:'NOT_CONFIGURED'});
 const caller=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
 const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
 try{
  const {data:user,error:authError}=await caller.auth.getUser();
  if(authError||!user.user||!user.user.email_confirmed_at)return response(401,{error:'NOT_AUTHORISED'});
  const {data:adminRole,error:roleError}=await caller.rpc('is_super_admin');
  if(roleError||adminRole!==true)return response(403,{error:'NOT_AUTHORISED'});
  const body=await req.json();const id=typeof body?.user_id==='string'?body.user_id:'';const action=body?.action;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||!['suspend','restore','delete'].includes(action))return response(400,{error:'INVALID_REQUEST'});
  const check=await caller.rpc('admin_member_target_allowed',{p_user:id});
  if(check.error||check.data!==true)return response(403,{error:'NOT_AUTHORISED'});
  if(action==='suspend'){
   // First block protected data access, even if the Auth API is unavailable.
   const marked=await caller.rpc('admin_member_set_suspension',{p_user:id,p_suspend:true});
   if(marked.error)return response(503,{error:'SUSPENSION_FAILED'});
   const banned=await admin.auth.admin.updateUserById(id,{ban_duration:'876000h'});
   if(banned.error)return response(503,{error:'AUTH_BAN_FAILED',access_suspended:true});
   return response(200,{status:'suspended'});
  }
  if(action==='restore'){
   const unban=await admin.auth.admin.updateUserById(id,{ban_duration:'none'});
   if(unban.error)return response(503,{error:'AUTH_UNBAN_FAILED'});
   const restored=await caller.rpc('admin_member_set_suspension',{p_user:id,p_suspend:false});
   if(restored.error)return response(503,{error:'RESTORE_FAILED',access_suspended:true});
   return response(200,{status:'restored'});
  }
  const recorded=await caller.rpc('admin_member_record_delete',{p_user:id,p_action:'delete_requested'});
  if(recorded.error)return response(503,{error:'AUDIT_FAILED'});
  const removed=await admin.auth.admin.deleteUser(id);
  if(removed.error)return response(503,{error:'DELETE_FAILED'});
  const logged=await caller.rpc('admin_member_record_delete',{p_user:id,p_action:'delete_completed'});
  return response(200,{status:'deleted',audit_recorded:!logged.error});
 }catch{return response(503,{error:'REQUEST_FAILED'});}
});
