import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { ArrowLeft, ArrowRight, Building2, CheckCircle2, Download, FileSpreadsheet, Filter, Info, LockKeyhole, LogOut, MapPin, Search, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { directoryClient, directoryQuery, emptyFilters, type DirectoryFilters, type SponsorRow } from './directoryClient';
import { directoryColumns as cols, directorySheet, directoryAutoFilter } from './directoryWorkbook.mjs';
import { CompanyHealth } from './CompanyHealth';

const PAGE_SIZE = 50;
type Access = 'checking' | 'not-configured' | 'signed-out' | 'not-member' | 'ready' | 'unpublished' | 'error';
type Facets = { industries: string[]; locations: string[]; routes: string[] };
const emptyFacets: Facets = { industries: [], locations: [], routes: [] };
const readError = (error: unknown) => error instanceof Error ? error.message : typeof error === 'object' && error && 'message' in error ? String(error.message) : 'Please try again.';

export function SponsorDirectory({ onMembership }: { onMembership: () => void }) {
  const [session, setSession] = useState<Session | null>(null);
  const [access, setAccess] = useState<Access>(directoryClient ? 'checking' : 'not-configured');
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false); const [message, setMessage] = useState('');
  const [facets, setFacets] = useState<Facets>(emptyFacets);
  const [filters, setFilters] = useState<DirectoryFilters>(emptyFilters);
  const [queryFilters, setQueryFilters] = useState<DirectoryFilters>(emptyFilters);
  const [page, setPage] = useState(0); const [rows, setRows] = useState<SponsorRow[]>([]);
  const [total, setTotal] = useState(0); const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false); const [exportProgress, setExportProgress] = useState('');
  const [retry, setRetry] = useState(0);
  const [versionLabel, setVersionLabel] = useState('');
  const [healthName, setHealthName] = useState<string | null>(null);
  const update = (key: keyof DirectoryFilters, value: string) => setFilters(current => ({ ...current, [key]: value }));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = useMemo(() => Object.values(filters).some(value => value.trim()), [filters]);
  const filtersPending = Object.keys(filters).some(key => filters[key as keyof DirectoryFilters] !== queryFilters[key as keyof DirectoryFilters]);

  useEffect(() => {
    if (!directoryClient) return;
    let live = true;
    directoryClient.auth.getSession().then(({ data, error }) => { if (live) { if (error) { setAccess('error'); setMessage('Could not check your session. Please try again.'); } else setSession(data.session); } });
    const { data } = directoryClient.auth.onAuthStateChange((_event, next) => { if (live) setSession(next); });
    return () => { live = false; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!directoryClient) return;
    let live = true;
    setRows([]); setTotal(0); setFacets(emptyFacets); setVersionLabel(''); setMessage('');
    if (!session) { setAccess('signed-out'); return () => { live = false; }; }
    setAccess('checking');
    (async () => {
      try {
        const member = await directoryClient!.rpc('has_job_hunt_pass');
        if (member.error) throw member.error;
        if (!member.data) { if (live) setAccess('not-member'); return; }
        const [metadata, options] = await Promise.all([
          directoryClient!.from('sponsor_directory_versions').select('source_label,source_date,record_count').eq('active', true).maybeSingle(),
          directoryClient!.rpc('sponsor_directory_facets'),
        ]);
        if (metadata.error) throw metadata.error;
        if (options.error) throw options.error;
        if (!metadata.data) { if (live) setAccess('unpublished'); return; }
        if (live) { setVersionLabel(metadata.data.source_label); setFacets(options.data as Facets || emptyFacets); setAccess('ready'); }
      } catch { if (live) { setMessage('Could not confirm access to the directory. Please try again.'); setAccess('error'); } }
    })();
    return () => { live = false; };
  }, [session?.user.id, retry]);
  useEffect(() => { const timer = window.setTimeout(() => { if (Object.keys(filters).some(key => filters[key as keyof DirectoryFilters] !== queryFilters[key as keyof DirectoryFilters])) setLoading(true); setPage(0); setQueryFilters(filters); }, 250); return () => window.clearTimeout(timer); }, [filters]);
  useEffect(() => {
    if (access !== 'ready') return;
    let live = true;
    setLoading(true); setRows([]); setMessage('');
    (async () => {
      try {
        const member = await directoryClient!.rpc('has_job_hunt_pass');
        if (member.error) throw member.error;
        if (!member.data) { if (live) { setRows([]); setTotal(0); setAccess('not-member'); } return; }
        const result = await directoryQuery(queryFilters, page * PAGE_SIZE, PAGE_SIZE);
        if (result.error) throw result.error;
        if (live) { setRows((result.data || []) as SponsorRow[]); setTotal(result.count || 0); }
      } catch { if (live) { setRows([]); setTotal(0); setMessage('Could not load the directory. Check your connection and try again.'); } }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [access, page, queryFilters, retry]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault(); if (!directoryClient || authBusy) return;
    setAuthBusy(true); setMessage('');
    try { const result = await directoryClient.auth.signInWithPassword({ email: email.trim(), password }); if (result.error) throw result.error; setPassword(''); }
    catch { setMessage('Could not sign in. Check your email and password and try again.'); }
    finally { setAuthBusy(false); }
  };
  const signOut = async () => { if (directoryClient) { setRows([]); setTotal(0); setAccess('checking'); const { error } = await directoryClient.auth.signOut(); if (error) { setAccess('error'); setMessage('Could not sign out. Please try again.'); } } };
  const exportXlsx = useCallback(async (which: 'filtered' | 'all') => {
    if (!directoryClient || exporting) return;
    setExporting(true); setMessage(''); setExportProgress('Preparing your workbook…');
    try {
      const chosen = which === 'filtered' ? queryFilters : emptyFilters;
      const all: SponsorRow[] = []; let expected: number | null = null;
      for (let offset = 0; ;) {
        const result = await directoryQuery(chosen, offset, 500);
        if (result.error) throw result.error;
        const count = result.count ?? null;
        if (count === null || (expected !== null && count !== expected)) throw new Error('Directory or access changed during download. Please try again.');
        expected = count;
        const batch = (result.data || []) as SponsorRow[];
        all.push(...batch); setExportProgress(`Preparing ${all.length.toLocaleString('en-GB')} of ${expected.toLocaleString('en-GB')} records…`);
        if (all.length === expected) break;
        if (!batch.length || all.length > expected) throw new Error('The directory changed during download. Please try again.');
        offset += batch.length;
      }
      if (!all.length) throw new Error('There are no records to download for these filters.');
      const allowed = await directoryClient.rpc('has_job_hunt_pass');
      if (allowed.error || !allowed.data) { setAccess('not-member'); throw new Error('Your Job Hunt Pass is not active.'); }
      const { default: writeExcelFile } = await import('write-excel-file/browser');
      // All values are explicitly written as strings; no data cell is interpreted as an Excel formula.
      const sheet = directorySheet(all);
      setExportProgress('Creating your Excel file…');
      await writeExcelFile(sheet, { sheet: 'Sponsor directory', columns: cols.map(col => ({ width: col.width })), stickyRowsCount: 1 }, { features: [directoryAutoFilter(all.length)] }).toFile(`scotsponsor-${which === 'all' ? 'full-directory' : 'filtered-directory'}.xlsx`);
      setExportProgress('Download ready.');
    } catch (error) { setMessage(readError(error)); setExportProgress(''); }
    finally { setExporting(false); }
  }, [exporting, queryFilters]);

  return <section className="directory-page"><div className="directory-heading"><div><div className="section-kicker">YOUR JOB HUNT PASS TOOLKIT <span>✳</span></div><h1>Find the right<br/><em>place to begin.</em></h1><p>Explore the Scottish sponsor directory by industry, location and visa route.</p></div><span className="directory-badge"><ShieldCheck size={15}/> JOB HUNT PASS</span></div>
    <div className="directory-disclaimer"><Info size={17}/><span><strong>About this directory:</strong> This is a supplied, undated snapshot—not a live UKVI register or a list of vacancies. Industry categories come from the supplied file. A sponsor licence does not guarantee sponsorship for a particular job. <a href="https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers" target="_blank" rel="noopener noreferrer">Check the current register</a>.</span></div>
    {access === 'checking' && <div className="directory-gate"><div className="directory-gate-icon"><ShieldCheck size={24}/></div><h2>Checking your access…</h2><p>We’re checking your account securely.</p></div>}
    {access === 'not-configured' && <div className="directory-gate"><div className="directory-gate-icon"><LockKeyhole size={24}/></div><span className="section-kicker">MEMBER ACCESS</span><h2>Your sponsor directory, in one place.</h2><p>Browse and download the full directory with a Job Hunt Pass. Secure member accounts and the directory are not connected yet, so it isn’t available to view or download.</p><div className="directory-benefits"><span><CheckCircle2 size={16}/> Filter by industry, location and route</span><span><CheckCircle2 size={16}/> Download the full or filtered Excel workbook</span><span><CheckCircle2 size={16}/> See all six columns in a spreadsheet-style view</span></div><button className="directory-primary" onClick={onMembership}>Explore the Job Hunt Pass <ArrowRight size={15}/></button></div>}
    {access === 'signed-out' && <div className="directory-gate"><div className="directory-gate-icon"><LockKeyhole size={24}/></div><span className="section-kicker">JOB HUNT PASS MEMBERS</span><h2>Welcome back.</h2><p>Sign in with your member account to access the sponsor directory.</p><form className="directory-login" onSubmit={signIn}><label>Email address<input type="email" autoComplete="email" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)}/></label>{message && <p className="directory-error" role="alert">{message}</p>}<button className="directory-primary" disabled={authBusy}>{authBusy ? 'Signing in…' : 'Sign in securely'} <ArrowRight size={15}/></button></form><button className="directory-secondary" onClick={onMembership}>Learn about the Job Hunt Pass</button></div>}
    {(access === 'not-member' || access === 'unpublished' || access === 'error') && <div className="directory-gate"><div className="directory-gate-icon"><LockKeyhole size={24}/></div><span className="section-kicker">MEMBER ACCESS</span><h2>{access === 'not-member' ? 'A Job Hunt Pass is needed.' : access === 'unpublished' ? 'The directory isn’t available yet.' : 'We couldn’t check your access.'}</h2><p>{access === 'not-member' ? 'This account does not have an active Job Hunt Pass. Paid subscriptions are not connected yet.' : access === 'unpublished' ? 'Your access is active, but the directory has not been published yet.' : message}</p><div className="directory-gate-actions"><button className="directory-primary" onClick={() => access === 'not-member' ? onMembership() : setRetry(value => value + 1)}>{access === 'not-member' ? 'Explore the Job Hunt Pass' : 'Try again'} <ArrowRight size={15}/></button>{session && <button className="directory-secondary" onClick={() => void signOut()}>Sign out</button>}</div></div>}
    {access === 'ready' && <><div className="directory-toolbar"><div><span className="section-kicker">YOUR SPONSOR DIRECTORY</span><h2>Explore the full directory</h2><p>{versionLabel || 'Supplied directory snapshot'} · Snapshot date not provided</p></div><div className="directory-account"><span><CheckCircle2 size={15}/> Job Hunt Pass active</span><button onClick={() => void signOut()}><LogOut size={14}/> Sign out</button></div></div>
      <div className="directory-search-panel"><div className="directory-filter-heading"><div><SlidersHorizontal size={17}/> Find the right organisations</div><button onClick={() => setFilters({ ...emptyFilters })} disabled={!hasFilters}><X size={14}/> Clear filters</button></div><div className="directory-filter-grid"><label><span>Organisation</span><div><Search size={16}/><input value={filters.search} maxLength={200} onChange={event => update('search', event.target.value)} placeholder="Search by name"/></div></label><label><span>Industry</span><div><Filter size={16}/><select value={filters.industry} onChange={event => update('industry', event.target.value)}><option value="">All industries</option>{facets.industries.map(item => <option key={item}>{item}</option>)}</select></div></label><label><span>City or town</span><div><MapPin size={16}/><input list="directory-cities" value={filters.location} maxLength={100} onChange={event => update('location', event.target.value)} placeholder="Type a location"/><datalist id="directory-cities">{facets.locations.map(item => <option key={item} value={item}/>)}</datalist></div></label><label><span>Visa route</span><div><Building2 size={16}/><select value={filters.route} onChange={event => update('route', event.target.value)}><option value="">All routes</option>{facets.routes.map(item => <option key={item}>{item}</option>)}</select></div></label></div></div>
      <div className="directory-results-header"><div><h3>Sponsor records <span>{loading || filtersPending ? '…' : total.toLocaleString('en-GB')}</span></h3><p>Browse all columns. Scroll sideways on smaller screens.</p></div><div className="directory-downloads"><button onClick={() => void exportXlsx('filtered')} disabled={exporting || loading || filtersPending || total === 0}><Download size={15}/> Download filtered</button><button onClick={() => void exportXlsx('all')} disabled={exporting || loading || filtersPending}><FileSpreadsheet size={15}/> Download all Excel</button></div></div>
      {exportProgress && <div className="directory-status" role="status">{exportProgress}</div>}{message && <div className="directory-error directory-error-box" role="alert">{message}</div>}
      <div className="directory-table-wrap" aria-busy={loading}><table className="directory-table"><thead><tr>{cols.map(col => <th key={col.key} scope="col">{col.label}</th>)}<th scope="col">Company health</th></tr></thead><tbody>{rows.map(row => <tr key={row.id}>{cols.map(col => <td key={col.key} data-label={col.label}>{col.key === 'industry_sector' ? <span className="directory-industry">{row[col.key]}</span> : row[col.key] || '—'}</td>)}<td><button className="health-open" onClick={() => setHealthName(row.organisation_name)}>Check record</button></td></tr>)}</tbody></table>{!loading && !rows.length && <div className="directory-empty"><Search size={22}/><strong>No records found</strong><p>Try another name, industry, city or visa route.</p><button onClick={() => setFilters({ ...emptyFilters })}>Clear filters</button></div>}{loading && <div className="directory-empty">Loading records…</div>}</div>
      <div className="directory-pagination"><span>{total ? `${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, total)} of ${total.toLocaleString('en-GB')} records` : 'No records to display'}</span><div><button onClick={() => setPage(value => Math.max(0, value - 1))} disabled={page === 0 || loading || filtersPending}><ArrowLeft size={14}/> Previous</button><span>Page {Math.min(page + 1, pages)} of {pages}</span><button onClick={() => setPage(value => value + 1)} disabled={page + 1 >= pages || loading || filtersPending}>Next <ArrowRight size={14}/></button></div></div><p className="directory-footnote">Downloads are Excel workbooks (.xlsx) with filterable column headers. Filtered downloads reflect the current search. The directory is provided as-is; always check the official register and employer before applying.</p></>}
    {healthName && <CompanyHealth name={healthName} onClose={() => setHealthName(null)}/>}
  </section>;
}
