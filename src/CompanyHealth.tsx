import { useCallback, useEffect, useState } from 'react';
import { Activity, ArrowRight, ExternalLink, X } from 'lucide-react';
import { directoryClient, type SponsorRow } from './directoryClient';

type Match = { number: string; name: string; status: string; address?: string; date?: string };
type Profile = { number: string; name: string; status: string; established: string | null; sicCodes: string[]; charges: { outstanding: number; partSatisfied: number } | null; fetchedAt: string; registeredOffice: string; recordUrl: string };
type SearchResult = { items: Match[]; truncated: boolean };
const label = (value?: string | null) => value ? value.replace(/-/g, ' ') : 'Not available';

export function CompanyHealth({ sponsor, onClose }: { sponsor: SponsorRow; onClose: () => void }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const request = useCallback(async (number?: string, signal?: AbortSignal) => {
    const session = await directoryClient!.auth.getSession();
    if (!session.data.session) throw new Error('Please sign in again.');
    const params = new URLSearchParams({ sponsor: String(sponsor.id) });
    if (number) params.set('number', number);
    const result = await fetch(`/api/company-health?${params}`, { headers: { Authorization: `Bearer ${session.data.session.access_token}` }, cache: 'no-store', signal });
    let json; try { json = await result.json(); } catch { throw new Error('Company health is not available in this environment.'); }
    if (!result.ok) throw new Error(json.error || 'Could not load Companies House data.');
    return json;
  }, [sponsor.id]);
  const search = useCallback(async (signal?: AbortSignal) => {
    setBusy(true); setError(''); setProfile(null); setMatches([]); setSearched(false); setTruncated(false);
    try {
      const data: SearchResult = await request(undefined, signal);
      if (signal?.aborted) return;
      setMatches(data.items); setTruncated(data.truncated); setSearched(true);
      // A single match is convenient to open, but it is still only a possible
      // match. If results were cut short, let the user choose explicitly.
      if (data.items.length === 1 && !data.truncated) {
        const details: Profile = await request(data.items[0].number, signal);
        if (!signal?.aborted) setProfile(details);
      }
    } catch (err) {
      if (!signal?.aborted) setError(err instanceof Error ? err.message : 'Please try again.');
    } finally { if (!signal?.aborted) setBusy(false); }
  }, [request]);
  useEffect(() => {
    const controller = new AbortController();
    void search(controller.signal);
    return () => controller.abort();
  }, [search]);
  const select = async (number: string) => {
    setBusy(true); setError('');
    try { setProfile(await request(number)); }
    catch (err) { setError(err instanceof Error ? err.message : 'Please try again.'); }
    finally { setBusy(false); }
  };
  const location = [sponsor.city_town, sponsor.county_region].filter(Boolean).join(', ');
  const officialSearch = `https://find-and-update.company-information.service.gov.uk/search?${new URLSearchParams({ q: sponsor.organisation_name })}`;
  return <div className="health-overlay" onMouseDown={onClose}><section className="health-dialog" role="dialog" aria-modal="true" aria-labelledby="health-title" onMouseDown={event => event.stopPropagation()}><button className="health-close" onClick={onClose} aria-label="Close company health"><X size={20}/></button>
    <div className="section-kicker">JOB HUNT PASS · COMPANIES HOUSE</div><h2 id="health-title">Company <em>health check.</em></h2>
    <p>Checking <strong>{sponsor.organisation_name}</strong>{location && <> · {location}</>}.</p>
    <p className="health-caveat">Only exact name and Scottish registered-office location matches are shown. A matching name and address do not prove this is the same sponsor. Confirm the company number and address with the employer.</p>
    {busy && <p role="status">Checking the Companies House record…</p>}
    {error && <div className="directory-error directory-error-box" role="alert">{error} <button className="directory-secondary" onClick={() => void search()} disabled={busy}>Try again</button></div>}
    {truncated && <p className="health-caveat" role="status">This search checked up to five pages of Companies House results; other matches may exist. Please check the official register.</p>}
    {!profile && matches.map(item => <button className="health-match" key={item.number} onClick={() => void select(item.number)} disabled={busy}><span><strong>{item.name}</strong><small>{item.number} · {label(item.status)} {item.address ? `· ${item.address}` : ''}</small></span><ArrowRight size={16}/></button>)}
    {searched && !busy && !matches.length && !error && <p>No exact match with a confirmed Scottish registered-office location was found{truncated ? ' in the results checked' : ''}. The registered office can differ from the sponsor’s directory location, or the organisation may not be a registered company. This does not mean the employer is illegitimate.</p>}
    {profile && <div className="health-profile">{matches.length > 1 && <button className="directory-secondary" onClick={() => setProfile(null)}>← Choose a different match</button>}<h3><Activity size={19}/>{profile.name}</h3><span className="health-number">COMPANY NUMBER {profile.number}</span><p><strong>Registered office:</strong> {profile.registeredOffice || 'Not available'}</p><div className="health-metrics"><div><span>Status</span><strong>{label(profile.status)}</strong></div><div><span>Established</span><strong>{profile.established || 'Not available'}</strong></div><div><span>Registered activity</span><strong>{profile.sicCodes.length ? profile.sicCodes.join(', ') : 'Not available'}</strong><small>Standard Industrial Classification (SIC) codes · <a href="https://www.gov.uk/government/publications/standard-industrial-classification-of-economic-activities-sic" target="_blank" rel="noopener noreferrer">Look up descriptions</a></small></div><div><span>Outstanding charges</span><strong>{profile.charges ? profile.charges.outstanding : 'Not available'}</strong>{profile.charges && profile.charges.partSatisfied > 0 && <small>{profile.charges.partSatisfied} part-satisfied</small>}</div></div><a href={profile.recordUrl} target="_blank" rel="noopener noreferrer">Companies House record {profile.number} <ExternalLink size={14}/></a><p className="health-caveat">Fetched {new Date(profile.fetchedAt).toLocaleString('en-GB')}. This is public filing information, not a financial health rating, credit check, proof of solvency, employer endorsement or sponsorship confirmation. Outstanding charges can be normal. Confirm the entity and review the official record.</p></div>}
    {!busy && <p><a href={officialSearch} target="_blank" rel="noopener noreferrer">Search the official Companies House register separately <ExternalLink size={14}/></a></p>}
  </section></div>;
}
