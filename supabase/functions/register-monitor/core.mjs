// Matching is exact after case and whitespace normalisation. No guessed links.
export const normalise = value => String(value ?? '').normalize('NFKC').trim().replace(/\s+/gu, ' ').toUpperCase();
const key = (name, town) => JSON.stringify([normalise(name), normalise(town)]);
const headerName = value => normalise(value).replace(/[^A-Z0-9]/g, '');

export function buildRegisterSnapshot(sponsors, csv, parse, minimumRows = 50000) {
  if (!Array.isArray(sponsors) || !sponsors.length) throw new Error('No active sponsor directory');
  const result = sponsors.map(s => ({ id:s.id, name:s.name, town:s.town, entries:[] }));
  const lookup = new Map();
  for (const row of result) {
    if (!normalise(row.name) || !normalise(row.town)) continue;
    const k = key(row.name, row.town);
    if (!lookup.has(k)) lookup.set(k, []);
    lookup.get(k).push(row);
  }
  let headers, count=0, matched=0;
  parse(csv, { bom:true, skip_empty_lines:true, on_record: row => {
    if (!headers) {
      headers = row.map(headerName);
      for (const required of ['ORGANISATIONNAME','TOWNCITY','COUNTY','TYPERATING','ROUTE']) if (!headers.includes(required)) throw new Error('Unexpected register columns');
      return null;
    }
    if (row.length !== headers.length) throw new Error('Incomplete register row');
    count++;
    const get = name => String(row[headers.indexOf(name)] || '').trim();
    const found = lookup.get(key(get('ORGANISATIONNAME'),get('TOWNCITY')));
    if (found) {
      const entry = { county:get('COUNTY'), rating:get('TYPERATING'), route:get('ROUTE') };
      if (!entry.rating || !entry.route) throw new Error('Incomplete register data');
      for (const item of found) { item.entries.push(entry); matched++; }
    }
    return null;
  }});
  if (!headers || count < minimumRows) throw new Error('Incomplete register');
  // Require meaningful overlap; protect against a changed source format or a
  // mistakenly empty result generating thousands of disappearance alerts.
  if (matched < Math.min(50, Math.ceil(result.length * 0.05))) throw new Error('Register matched too few sponsors');
  for (const item of result) {
    const entries = new Map(item.entries.map(entry => [JSON.stringify(entry),entry]));
    item.entries = [...entries.entries()].sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0).map(([,entry])=>entry);
  }
  return result;
}
