import { createClient } from '@supabase/supabase-js';

// Public project settings only. Environment variables can point a deployment at a different project.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://ybsbeyyiwnhihkodbedv.supabase.co';
const key = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_2Cgs8BfrmrcqZcUVYprShg_DPpQgD2P';
// These are public project settings, never a service-role/secret key.
export const directoryClient = url && key ? createClient(url, key) : null;

export type SponsorRow = {
  id: number;
  organisation_name: string;
  city_town: string;
  county_region: string;
  industry_sector: string;
  visa_route: string;
  licence_rating: string;
};
export type DirectoryFilters = { search: string; industry: string; location: string; route: string };
export const emptyFilters: DirectoryFilters = { search: '', industry: '', location: '', route: '' };

// Escape LIKE wildcards so searches for literal %, _ and backslash do not change the filter.
export function escapeLike(value: string): string { return value.replace(/[\\%_]/g, '\\$&'); }
export function directoryQuery(filters: DirectoryFilters, from: number, size: number) {
  if (!directoryClient) throw new Error('The directory has not been configured.');
  let query = directoryClient.from('sponsor_directory').select('id,organisation_name,city_town,county_region,industry_sector,visa_route,licence_rating', { count: 'exact' }).order('organisation_name', { ascending: true }).order('id', { ascending: true });
  if (filters.search.trim()) query = query.ilike('organisation_name', `%${escapeLike(filters.search.trim())}%`);
  if (filters.industry) query = query.eq('industry_sector', filters.industry);
  if (filters.location.trim()) query = query.ilike('city_town', `%${escapeLike(filters.location.trim())}%`);
  if (filters.route) query = query.eq('visa_route', filters.route);
  return query.range(from, from + size - 1);
}
