import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Bell, CheckCircle2, ExternalLink, RefreshCw, ShieldCheck } from 'lucide-react';
import { directoryClient } from './directoryClient';

type RegisterEntry = { county: string; rating: string; route: string };
type Notice = { id: number; kind: string; organisation_name: string | null; city_town: string | null; before_entries: RegisterEntry[] | null; after_entries: RegisterEntry[] | null; source_url: string | null; occurred_at: string; is_read: boolean };
type Feed = { unread: number; items: Notice[]; monitor: { last_checked: string | null; last_success: string | null; source_published: string | null; last_error: string | null } };
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString('en-GB', { dateStyle:'medium', timeStyle:'short' }) : 'Not yet';

export function useAdminAlerts(session: Session | null) {
  const [adminUserId, setAdminUserId] = useState<string | null>(null);
  const isAdmin = !!session && adminUserId === session.user.id;
  const [checkedUserId, setCheckedUserId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState(false);
  const roleReady = !session || checkedUserId === session.user.id;
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setAdminUserId(null); setCheckedUserId(null); setRoleError(false); setFeed(null); setError(false);
    if (!session || !directoryClient) return () => { active = false; };
    const load = async () => {
      try {
        const admin = await directoryClient!.rpc('is_super_admin');
        if (!active) return;
        if (admin.error) throw admin.error;
        setCheckedUserId(session.user.id); setRoleError(false);
        if (admin.data !== true) { setAdminUserId(null); setFeed(null); setError(false); return; }
        setAdminUserId(session.user.id);
      } catch {
        if (active) { setAdminUserId(null); setCheckedUserId(null); setRoleError(true); setFeed(null); setError(true); }
        return;
      }
      try {
        const result = await directoryClient!.rpc('admin_notification_feed');
        if (!active) return;
        if (result.error) setError(true);
        else { setFeed(result.data as Feed); setError(false); }
      } catch { if (active) setError(true); }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60000);
    window.addEventListener('focus', load);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', load); };
  }, [session?.user.id]);
  const refresh = useCallback(async () => {
    if (!isAdmin || !directoryClient) return;
    const result = await directoryClient.rpc('admin_notification_feed');
    if (result.error) setError(true); else { setFeed(result.data as Feed); setError(false); }
  }, [isAdmin]);
  return { isAdmin, roleReady, roleError, feed, error, refresh };
}

function EntryList({ entries }: { entries: RegisterEntry[] | null }) {
  if (!entries?.length) return <span>No exact name and town match in this snapshot.</span>;
  return <ul>{entries.map((entry, index) => <li key={index}>{entry.route} · {entry.rating}{entry.county ? ` · ${entry.county}` : ''}</li>)}</ul>;
}
export function AdminAlerts({ feed, error, refresh }: { feed: Feed | null; error: boolean; refresh: () => Promise<void> }) {
  const [marking, setMarking] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const markRead = async (id: number) => {
    setMarking(id); setMessage('');
    const result = await directoryClient!.rpc('admin_notification_read', {p_id:id});
    if (result.error) setMessage('Could not mark that alert as read. Please try again.');
    else await refresh();
    setMarking(null);
  };
  const delayed = !!feed?.monitor.last_success && Date.now() - Date.parse(feed.monitor.last_success) > 48 * 60 * 60 * 1000;
  return <section className="account-page admin-alert-page">
    <div className="section-kicker">SUPER ADMINISTRATOR · PRIVATE</div><div className="admin-alert-heading"><div><h1>Alerts &amp; <em>activity.</em></h1><p>Your directory, monitored against the Home Office register.</p></div><button className="directory-secondary" onClick={() => void refresh()}><RefreshCw size={15}/> Refresh</button></div>
    <div className="admin-monitor-status"><div><span>HOME OFFICE REGISTER</span><strong>{feed?.monitor.last_error ? 'Last check failed' : delayed ? 'Check delayed' : feed?.monitor.last_success ? 'Monitoring' : 'Awaiting first check'}</strong><small>Last checked: {dateTime(feed?.monitor.last_checked || null)}</small><small>Last successful check: {dateTime(feed?.monitor.last_success || null)}</small><small>Source updated: {dateTime(feed?.monitor.source_published || null)}</small></div><ShieldCheck size={26}/></div>
    {delayed && <div className="directory-error directory-error-box" role="alert">No successful check in over 48 hours. The displayed snapshot may be out of date; please review the monitor.</div>}
    <div className="account-note"><Bell size={18}/><span><strong>Job-board alerts are not connected.</strong> The register does not list vacancies or establish whether a particular role offers sponsorship. Choose a job feed later to enable those alerts.</span></div>
    <p className="admin-alert-explainer">Checks compare exact organisation names and towns in your directory with the published register. The first successful check establishes a baseline; subsequent route, rating, county or presence changes appear here. The register is checked daily at 18:00 UTC. A missing match can reflect a name or address change and is not proof a licence was revoked. <a href="https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers" target="_blank" rel="noopener noreferrer">View the official register <ExternalLink size={13}/></a></p>
    {error && <div className="directory-error directory-error-box" role="alert">Could not load alerts. Please refresh.</div>}{message && <div className="directory-error directory-error-box" role="alert">{message}</div>}
    <h2 className="account-section-title"><Bell size={19}/> Recent alerts {feed && <span className="admin-alert-count">{feed.unread} unread</span>}</h2>
    {!feed && !error && <div className="directory-status">Loading alerts…</div>}
    {feed && feed.items.length === 0 && <div className="admin-alert-empty"><CheckCircle2 size={22}/><strong>No alerts yet</strong><span>Changes discovered after the first successful check will appear here.</span></div>}
    <div className="admin-alert-list">{feed?.items.map(item => <article className={`admin-alert-item ${item.is_read ? '' : 'unread'}`} key={item.id}>
      <div className="admin-alert-top"><div><span className="admin-alert-label">{item.kind === 'monitor_error' ? 'CHECK FAILED' : 'REGISTER CHANGE'} {item.is_read ? '' : '· NEW'}</span><h3>{item.kind === 'monitor_error' ? 'The daily register check failed' : item.organisation_name}</h3><p>{item.kind === 'monitor_error' ? 'The previous successful snapshot is retained. Please check the source and monitor status.' : item.city_town} · {dateTime(item.occurred_at)}</p></div>{!item.is_read && <button className="directory-secondary" disabled={marking === item.id} onClick={() => void markRead(item.id)}>Mark read</button>}</div>
      {item.kind === 'register_change' && <div className="admin-alert-diff"><div><strong>Previously</strong><EntryList entries={item.before_entries}/></div><div><strong>Latest snapshot</strong><EntryList entries={item.after_entries}/></div></div>}
      {item.source_url && <a href={item.source_url} target="_blank" rel="noopener noreferrer">View source snapshot <ExternalLink size={13}/></a>}
    </article>)}</div>
    {feed && feed.items.length >= 100 && <p className="admin-alert-explainer">Showing the latest 100 alerts.</p>}
  </section>;
}
