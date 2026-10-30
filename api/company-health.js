import { createClient } from '@supabase/supabase-js';
import { matchesSponsor, registeredOffice } from '../lib/company-match.js';

const projectUrl = process.env.VITE_SUPABASE_URL || 'https://ybsbeyyiwnhihkodbedv.supabase.co';
const publicKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2Cgs8BfrmrcqZcUVYprShg_DPpQgD2P';
const base = 'https://api.company-information.service.gov.uk';
const respond = (res, status, data) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'private, no-store'); res.end(JSON.stringify(data)); };

// Never log or return the API key, request headers or upstream response body.
function upstreamError(res, status) {
  const reference = Number.isInteger(status) && status >= 100 && status <= 599 ? `CH-${status}` : 'CH-UNKNOWN';
  console.error('Companies House request failed:', reference);
  if (status === 401 || status === 403) return respond(res, 502, { error: `Companies House rejected the connection (${reference}). The site administrator should check the live REST API key and its restrictions.`, code: reference });
  if (status === 429) return respond(res, 429, { error: 'Companies House is busy. Please try again later.', code: reference });
  if (status >= 500) return respond(res, 502, { error: `Companies House is temporarily unavailable (${reference}). Please try again later.`, code: reference });
  return respond(res, 502, { error: `Companies House returned an unexpected response (${reference}). Please contact the site administrator.`, code: reference });
}

// Dependencies are injectable so access control and third-party responses can be tested offline.
export function makeCompanyHealthHandler({ create = createClient, request = fetch, apiKey = process.env.COMPANIES_HOUSE_API_KEY } = {}) {
  // A copied Vercel value can include an accidental trailing newline or space.
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
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
      if (!key) return respond(res, 503, { error: 'Companies House is not configured yet.', code: 'CH-NOT-CONFIGURED' });
      const url = new URL(req.url || '/', 'http://local');
      const sponsorId = url.searchParams.get('sponsor')?.trim();
      const number = url.searchParams.get('number')?.trim().toUpperCase();
      if (!sponsorId || !/^[1-9][0-9]{0,17}$/.test(sponsorId) || (number && !/^[A-Z0-9]{8}$/.test(number))) return respond(res, 400, { error: 'Please refresh the page and choose a sponsor record.' });
      // Read the selected active directory row under the caller's RLS permissions.
      const sponsorResult = await client.from('sponsor_directory').select('organisation_name,city_town,county_region').eq('id', sponsorId).maybeSingle();
      if (sponsorResult.error) return respond(res, 503, { error: 'Could not load the selected sponsor. Please try again.' });
      const sponsor = sponsorResult.data;
      if (!sponsor) return respond(res, 404, { error: 'That sponsor record is no longer available.' });
      if (!sponsor.organisation_name?.trim() || !sponsor.city_town?.trim()) return number ? respond(res, 409, { error: 'This sponsor does not have enough location information to check a company record.' }) : respond(res, 200, { items: [], truncated: false });
      const get = async path => request(`${base}${path}`, { headers: { Authorization: `Basic ${Buffer.from(`${key}:`).toString('base64')}`, Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
      if (!number) {
        const matches = [];
        const pageSize = 100;
        const pageLimit = 5;
        let truncated = false;
        let offset = 0;
        for (let page = 0; page < pageLimit; page++) {
          const response = await get(`/search/companies?q=${encodeURIComponent(sponsor.organisation_name.trim())}&items_per_page=${pageSize}&start_index=${offset}`);
          if (!response.ok) return upstreamError(res, response.status);
          const json = await response.json();
          if (!Array.isArray(json.items)) return respond(res, 502, { error: 'Companies House returned an incomplete search response. Please try again.' });
          const items = json.items;
          for (const item of items) {
            if (matchesSponsor(item, sponsor) && !matches.some(match => match.number === item.company_number)) matches.push({ number: item.company_number, name: item.title, status: item.company_status, address: registeredOffice(item.address), date: item.date_of_creation });
          }
          const scanned = offset + items.length;
          const hasMore = Number.isInteger(json.total_results) ? scanned < json.total_results : items.length === pageSize;
          if (!items.length) { if (hasMore) truncated = true; break; }
          if (!hasMore) break;
          offset = scanned;
          if (page === pageLimit - 1) truncated = true;
        }
        return respond(res, 200, { items: matches, truncated });
      }
      const response = await get(`/company/${number}`);
      if (response.status === 404) return respond(res, 404, { error: 'Company not found.' });
      if (!response.ok) return upstreamError(res, response.status);
      const profile = await response.json();
      // Revalidate the name and office because the Companies House record can
      // change between search and viewing, and company numbers are user input.
      if (profile.company_number !== number || !matchesSponsor({ title: profile.company_name, company_number: profile.company_number, address: profile.registered_office_address }, sponsor)) {
        return respond(res, 409, { error: 'The company name or Scottish registered office no longer matches this directory record. Check the official register.' });
      }
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
      return respond(res, 200, { number: profile.company_number, name: profile.company_name, status: profile.company_status, established: profile.date_of_creation || null, sicCodes: profile.sic_codes || [], charges, fetchedAt: new Date().toISOString(), registeredOffice: registeredOffice(profile.registered_office_address), recordUrl: `https://find-and-update.company-information.service.gov.uk/company/${number}` });
    } catch { return respond(res, 502, { error: 'Company information is temporarily unavailable.' }); }
  };
}
export default makeCompanyHealthHandler();
