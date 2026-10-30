import { parse } from 'node-html-parser';

export const OCCUPATIONS_URL = 'https://www.gov.uk/government/publications/skilled-worker-visa-eligible-occupations/skilled-worker-visa-eligible-occupations-and-codes';
export const RATES_URL = 'https://www.gov.uk/government/publications/skilled-worker-visa-going-rates-for-eligible-occupations/skilled-worker-visa-going-rates-for-eligible-occupation-codes';
export const UPDATE_SOURCES = [
  { title: 'Immigration Rules', path: '/guidance/immigration-rules', filter: /skilled worker|skilled occupations|health and care|immigration salary|shortage list/i },
  { title: 'Sponsor a Skilled Worker', path: '/government/publications/sponsor-a-skilled-worker' },
  { title: 'Eligible occupations', path: '/government/publications/skilled-worker-visa-eligible-occupations' },
  { title: 'Occupation going rates', path: '/government/publications/skilled-worker-visa-going-rates-for-eligible-occupations' },
  { title: 'Health and Care visa guidance', path: '/government/publications/health-and-care-visa-guidance-for-applicants' },
];
const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const text = node => clean((node?.structuredText || node?.textContent || '').replace(/\u00a0/g, ' '));

function tableRows(html, kind) {
  if (typeof html !== 'string' || html.length > 6000000) throw new Error('Invalid government page');
  const document = parse(html);
  for (const table of document.querySelectorAll('table')) {
    const trs = table.querySelectorAll('tr');
    if (trs.length < 2) continue;
    const headers = trs[0].querySelectorAll('th,td').map(cell => text(cell).toLowerCase());
    const code = headers.findIndex(x => x.includes('occupation code'));
    const title = headers.findIndex(x => x.includes('job type'));
    const related = headers.findIndex(x => x.includes('related job titles'));
    const status = headers.findIndex(x => x.includes('eligible for skilled worker'));
    const standard = headers.findIndex(x => x.includes('standard going rate'));
    const lower = headers.findIndex(x => x.includes('lower going rate'));
    if (code < 0 || title < 0 || related < 0 || (kind === 'occupation' ? status < 0 : standard < 0 || lower < 0)) continue;
    const rows = [];
    for (const tr of trs.slice(1)) {
      const cells = tr.querySelectorAll('td,th').map(text);
      const value = cells[code] || '';
      if (!/^\d{4}$/.test(value)) continue;
      if (!cells[title]) throw new Error('Incomplete government table');
      rows.push(kind === 'occupation' ? { code:value, title:cells[title], related:cells[related], category:cells[status] } : { code:value, standard:cells[standard], lower:cells[lower] });
    }
    if (rows.length < 10) throw new Error('Incomplete government table');
    return rows;
  }
  throw new Error('Government table format changed');
}
export function parseOccupationTables(occupationsHtml, ratesHtml) {
  const occupations = tableRows(occupationsHtml, 'occupation');
  const rates = tableRows(ratesHtml, 'rates');
  const rateMap = new Map(rates.map(row => [row.code, row]));
  return occupations.map(row => ({ ...row, rates:rateMap.get(row.code) || null }));
}
export function searchOccupations(rows, term) {
  const tokens = clean(term).toLowerCase().split(' ').filter(Boolean);
  if (!tokens.length) return { total:0, items:[] };
  const found = rows.filter(row => { const all = `${row.code} ${row.title} ${row.related}`.toLowerCase(); return tokens.every(token => all.includes(token)); });
  return { total:found.length, items:found.slice(0, 30) };
}
export function extractUpdates(sources) {
  const events = [];
  for (const { config, data } of sources) {
    const history = Array.isArray(data?.details?.change_history) ? data.details.change_history : [];
    for (const entry of history) {
      const note = text(parse(String(entry.note || '')));
      if (!note || !entry.public_timestamp || Number.isNaN(Date.parse(entry.public_timestamp))) continue;
      if (config.filter && !config.filter.test(note)) continue;
      events.push({ title:config.title, note, published:entry.public_timestamp, url:`https://www.gov.uk${config.path}` });
    }
  }
  return events.sort((a,b) => Date.parse(b.published) - Date.parse(a.published)).slice(0,30);
}
