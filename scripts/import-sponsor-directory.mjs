// Administrative import only. Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
import { readFile } from 'node:fs/promises';
import { parse } from 'csv-parse/sync';
import { createClient } from '@supabase/supabase-js';

const [path, option] = process.argv.slice(2);
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!path || (option && option !== '--validate-only')) {
  console.error('Usage: node scripts/import-sponsor-directory.mjs /path/to/directory.csv [--validate-only]');
  process.exit(1);
}
const expectedHeaders = ['Organisation Name', 'City / Town', 'County / Region', 'Industry Sector', 'Visa Route', 'Licence Type & Rating'];
const contents = await readFile(path, 'utf8');
const records = parse(contents, { bom: true, columns: true, skip_empty_lines: true, relax_column_count: false });
if (!records.length || expectedHeaders.some(key => !(key in records[0])) || Object.keys(records[0]).length !== expectedHeaders.length) throw new Error('Unexpected CSV headers or an empty file.');
if (option === '--validate-only') {
  console.log(`Validated ${records.length} records, ${new Set(records.map(row => row['Industry Sector'].trim())).size} industries and ${new Set(records.map(row => row['City / Town'].trim())).size} cities/towns.`);
  process.exit(0);
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('For import, set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your local environment. Never put the service key in client variables.');
  process.exit(1);
}
const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: version, error: createError } = await client.from('sponsor_directory_versions').insert({ source_label: 'Scotland Licensed Sponsors Directory (supplied CSV; snapshot date unknown)', source_date: null, record_count: records.length }).select('id').single();
if (createError) throw createError;
try {
  for (let i = 0; i < records.length; i += 200) {
    const batch = records.slice(i, i + 200).map((row, offset) => ({
      version_id: version.id, source_row: i + offset + 1,
      organisation_name: row['Organisation Name'].trim(), city_town: row['City / Town'].trim(), county_region: row['County / Region'].trim(),
      industry_sector: row['Industry Sector'].trim(), visa_route: row['Visa Route'].trim(), licence_rating: row['Licence Type & Rating'].trim(),
    }));
    const { error } = await client.from('sponsor_directory').insert(batch);
    if (error) throw error;
    console.log(`Staged ${Math.min(i + batch.length, records.length)} / ${records.length}`);
  }
  const { error } = await client.rpc('activate_sponsor_directory', { p_version: version.id });
  if (error) throw error;
  console.log(`Activated directory version ${version.id} with ${records.length} records.`);
} catch (error) {
  console.error(`Import failed. The previous active version is unchanged; remove staged version ${version.id} from the database after investigating.`);
  throw error;
}
