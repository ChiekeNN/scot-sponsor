import { createClient } from '@supabase/supabase-js';

const projectUrl = process.env.VITE_SUPABASE_URL || 'https://ybsbeyyiwnhihkodbedv.supabase.co';
const publicKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2Cgs8BfrmrcqZcUVYprShg_DPpQgD2P';
const base = 'https://api.company-information.service.gov.uk';
const respond = (res, status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(data)); };

// Dependencies are injectable so access control and third-party responses can be tested offline.
export function makeCompanyHealthHandler({ create = createClient, request = fetch, apiKey = process.env.COMPANIES_HOUSE_API_KEY } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'GET') return respond(res, 405, { error: 'Method not allowed.' });
    const token = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')?.[1];
    if (!token) return respond(res, 401, { error: 'Sign in to continue.' });
    try {
      const client = create(projectUrl, publicKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false, autoRefreshToken: false } });
      const { data: identity, error: identityError } = await client.auth.getUser(token);
      if (identityError || !identity?.user) return respond(res, 401, { error: 'Sign in to continue.' });
      const { data: entitled, error: accessError } = await client.rpc('can_access_job_hunt');
      if (accessError) return respond(res, 503, { error: 'Could not verify membership.' });
      if (!entitled) return respond(res, 403, { error: 'An active Job Hunt Pass or super-admin access is required.' });
      if (!apiKey) return respond(res, 503, { error: 'Companies House is not configured yet.' });
      const url = new URL(req.url || '/', 'http://local');
      const search = url.searchParams.get('search')?.trim();
      const number = url.searchParams.get('number')?.trim().toUpperCase();
      if ((!search && !number) || (search && number) || (search && (search.length < 2 || search.length > 150)) || (number && !/^[A-Z0-9]{8}$/.test(number))) return respond(res, 400, { error: 'Enter a company name or valid company number.' });
      const get = async path => request(`${base}${path}`, { headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString('base64')}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
      if (search) {
        const response = await get(`/search/companies?q=${encodeURIComponent(search)}&items_per_page=10`);
        if (!response.ok) return respond(res, response.status === 429 ? 429 : 502, { error: response.status === 429 ? 'Companies House is busy. Try again later.' : 'Companies House search is unavailable.' });
        const json = await response.json();
        return respond(res, 200, { items: (json.items || []).map(item => ({ number: item.company_number, name: item.title, status: item.company_status, address: item.address_snippet, date: item.date_of_creation })).filter(item => /^[A-Z0-9]{8}$/.test(item.number || '')) });
      }
      const response = await get(`/company/${number}`);
      if (response.status === 404) return respond(res, 404, { error: 'Company not found.' });
      if (!response.ok) return respond(res, response.status === 429 ? 429 : 502, { error: 'Companies House profile is unavailable.' });
      const profile = await response.json();
      let charges = null;
      if (profile.has_charges === false) charges = { outstanding: 0, partSatisfied: 0 };
      else {
        let items = []; let total = null;
        for (let offset = 0; offset < 1000; offset += 100) {
          const page = await get(`/company/${number}/charges?items_per_page=100&start_index=${offset}`);
          if (!page.ok) break;
          const list = await page.json();
          if (!Number.isInteger(list.total_count) || (total !== null && total !== list.total_count)) break;
          total = list.total_count;
          const next = Array.isArray(list.items) ? list.items : [];
          items.push(...next);
          if (items.length === total) { charges = { outstanding: items.filter(x => x.status === 'outstanding').length, partSatisfied: items.filter(x => x.status === 'part-satisfied').length }; break; }
          if (!next.length || items.length > total) break;
        }
      }
      return respond(res, 200, { number: profile.company_number, name: profile.company_name, status: profile.company_status, established: profile.date_of_creation || null, sicCodes: profile.sic_codes || [], charges, fetchedAt: new Date().toISOString(), recordUrl: `https://find-and-update.company-information.service.gov.uk/company/${number}` });
    } catch { return respond(res, 502, { error: 'Company information is temporarily unavailable.' }); }
  };
}
export default makeCompanyHealthHandler();
