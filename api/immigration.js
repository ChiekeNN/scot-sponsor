import { createClient } from '@supabase/supabase-js';
import { OCCUPATIONS_URL, RATES_URL, UPDATE_SOURCES, parseOccupationTables, searchOccupations, extractUpdates } from '../lib/gov-insights.js';
const projectUrl = process.env.VITE_SUPABASE_URL || 'https://ybsbeyyiwnhihkodbedv.supabase.co';
const publicKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2Cgs8BfrmrcqZcUVYprShg_DPpQgD2P';
const respond = (res, code, body) => { res.statusCode=code; res.setHeader('Content-Type','application/json; charset=utf-8'); res.setHeader('Cache-Control','private, no-store'); res.end(JSON.stringify(body)); };

export function makeImmigrationHandler({ create = createClient, request = fetch } = {}) {
  let occupationCache = null; let updateCache = null;
  const get = async url => { const response = await request(url, { headers:{Accept:'application/json, text/html'}, signal:AbortSignal.timeout(15000), redirect:'error' }); if (!response.ok) throw new Error('Government source unavailable'); return response; };
  return async (req,res) => {
    if (req.method !== 'GET') return respond(res,405,{error:'Method not allowed.'});
    const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')?.[1];
    if (!token) return respond(res,401,{error:'Sign in to continue.'});
    try {
      const client = create(projectUrl, publicKey, {global:{headers:{Authorization:`Bearer ${token}`}},auth:{persistSession:false,autoRefreshToken:false}});
      const identity = await client.auth.getUser(token);
      if (identity.error || !identity.data?.user) return respond(res,401,{error:'Sign in to continue.'});
      const allowed = await client.rpc('can_access_member_insights');
      if (allowed.error) return respond(res,503,{error:'Could not verify membership.'});
      if (!allowed.data) return respond(res,403,{error:'An active membership or super-admin access is required.'});
      const url = new URL(req.url || '/', 'http://local');
      const kind = url.searchParams.get('kind');
      if (kind === 'occupation') {
        const q = (url.searchParams.get('q') || '').trim();
        if (q.length < 2 || q.length > 100) return respond(res,400,{error:'Enter at least two characters (up to 100).'});
        if (!occupationCache || Date.now()-occupationCache.time > 900000) {
          const [occupations, rates] = await Promise.all([get(OCCUPATIONS_URL), get(RATES_URL)]);
          const rows = parseOccupationTables(await occupations.text(), await rates.text());
          const metadata = await Promise.allSettled([OCCUPATIONS_URL,RATES_URL].map(async source => (await (await get(source.replace('https://www.gov.uk/', 'https://www.gov.uk/api/content/'))).json()).public_updated_at || null));
          occupationCache = {time:Date.now(),rows, updated:metadata.map(x => x.status === 'fulfilled' ? x.value : null)};
        }
        return respond(res,200,{...searchOccupations(occupationCache.rows,q), fetchedAt:new Date(occupationCache.time).toISOString(), sources:[OCCUPATIONS_URL,RATES_URL], sourceUpdated:occupationCache.updated});
      }
      if (kind === 'updates') {
        if (!updateCache || Date.now()-updateCache.time > 900000) {
          const responses = await Promise.allSettled(UPDATE_SOURCES.map(async config => ({config,data:await (await get(`https://www.gov.uk/api/content${config.path}`)).json()})));
          const sources = responses.filter(x => x.status === 'fulfilled').map(x => x.value);
          if (!sources.length) throw new Error('Government updates unavailable');
          updateCache = {time:Date.now(),items:extractUpdates(sources), unavailable:UPDATE_SOURCES.length-sources.length};
        }
        return respond(res,200,{items:updateCache.items, unavailable:updateCache.unavailable, fetchedAt:new Date(updateCache.time).toISOString()});
      }
      return respond(res,400,{error:'Choose an information source.'});
    } catch { return respond(res,502,{error:'Official information is temporarily unavailable or its format has changed. Please check GOV.UK directly.'}); }
  };
}
export default makeImmigrationHandler();
