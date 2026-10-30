import { createClient } from 'npm:@supabase/supabase-js@2';
import { parse } from 'npm:csv-parse@5.6.0/sync';
import { buildRegisterSnapshot } from './core.mjs';

const SOURCE = 'https://www.gov.uk/api/content/government/publications/register-of-licensed-sponsors-workers';
const db = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), {auth:{persistSession:false}});
Deno.serve(async request => {
  if (request.method !== 'POST') return new Response('Method not allowed', {status:405});
  const token = request.headers.get('x-monitor-token') || '';
  if (token.length !== 64) return new Response('Unauthorised', {status:401});
  const auth = await db.rpc('register_monitor_authorise', {p_token:token});
  if (auth.error || auth.data !== true) return new Response('Unauthorised', {status:401});
  let stage = 'directory';
  try {
    const directory = await db.rpc('register_monitor_sponsors');
    if (directory.error || !directory.data?.version || !directory.data?.sponsors?.length) throw new Error('Directory unavailable');
    stage = 'metadata';
    const metadataResponse = await fetch(SOURCE, {signal:AbortSignal.timeout(30000), redirect:'error'});
    if (!metadataResponse.ok) throw new Error('Source unavailable');
    const metadata = await metadataResponse.json();
    stage = 'attachment';
    const attachments = metadata.details?.attachments?.filter(a => a.content_type === 'text/csv') || [];
    if (attachments.length !== 1) throw new Error('Register attachment unavailable');
    const attachment = attachments[0];
    const url = new URL(attachment.url);
    if (url.protocol !== 'https:' || url.hostname !== 'assets.publishing.service.gov.uk' || !url.pathname.startsWith('/media/') || !Number.isInteger(attachment.file_size) || attachment.file_size < 100000 || attachment.file_size > 100000000) throw new Error('Invalid register attachment');
    const published = metadata.public_updated_at || metadata.details?.change_history?.[0]?.public_timestamp;
    if (!published || Number.isNaN(Date.parse(published))) throw new Error('Register publication date unavailable');
    stage = 'download';
    const response = await fetch(url, {signal:AbortSignal.timeout(60000), redirect:'error'});
    if (!response.ok) throw new Error('Register download failed');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength !== attachment.file_size) throw new Error('Incomplete register download');
    stage = 'parse';
    const rows = buildRegisterSnapshot(directory.data.sponsors, new TextDecoder('utf-8',{fatal:true}).decode(bytes), parse);
    stage = 'save';
    const applied = await db.rpc('register_monitor_apply_text', {p_version:directory.data.version, p_url:url.href, p_published:published, p_rows_text:JSON.stringify(rows)});
    if (applied.error) { stage = `save-${applied.error.code || String(applied.status)}`; throw new Error('Snapshot could not be saved'); }
    return Response.json({ok:true, changes:applied.data});
  } catch {
    // A failure is visible to the super admin; never log the token or source body.
    await db.rpc('register_monitor_fail');
    return Response.json({ok:false,error:'Register check failed',stage}, {status:502});
  }
});
