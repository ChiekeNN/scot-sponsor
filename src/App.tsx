import { useEffect, useMemo, useState } from 'react';
import { HomePage, ToolsPage, TrackerPage, InstallCard } from './Features';
import { PublicLanding, AccessModal } from './Landing';
import { plans } from './plans';
import { CvStudio } from './CvStudio';
import { Journal } from './Journal';
import { SponsorDirectory } from './SponsorDirectory';
import { AccountCenter } from './AccountCenter';
import { AdminAlerts, useAdminAlerts } from './AdminAlerts';
import { ImmigrationInsights } from './ImmigrationInsights';
import { MemberTools } from './MemberTools';
import { PartnerJobs } from './PartnerJobs';
import { MemberChat } from './MemberChat';
import {browseFromSearch,browseHref,clearBrowseUrl} from './jobBrowse.mjs';
import type {BrowseSelection} from './jobBrowse.mjs';
import { directoryClient } from './directoryClient';
import type { Session } from '@supabase/supabase-js';
import { BookOpen, FileText, Home, Calculator, ClipboardList, ArrowRight, Bell, Bookmark, Briefcase, Building2, Check, CheckCircle2, ChevronRight, HelpCircle, ExternalLink, GraduationCap, Info, LayoutDashboard, Menu, MessageCircle, ShieldCheck, Sparkles, X } from 'lucide-react';

const SAVED_JOBS_KEY = 'scotsponsor-saved-real';
const isPublicJournalHash = () => window.location.hash === '#journal' || window.location.hash.startsWith('#guide-');
function readSaved(): string[] { try { const value = JSON.parse(localStorage.getItem(SAVED_JOBS_KEY) || '[]'); return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length <= 100))].slice(0,2000) : []; } catch { return []; } }
function App() {
  const initialBrowse = useMemo(() => browseFromSearch(window.location.search), []);
  const [showLanding, setShowLanding] = useState(true);
  const [browseSelection, setBrowseSelection] = useState<BrowseSelection | null>(initialBrowse);
  const [session, setSession] = useState<Session | null>(null);
  const [recovering, setRecovering] = useState(false);
  const [accountSignup, setAccountSignup] = useState(false);
  const [accessModal, setAccessModal] = useState<'membership' | 'signin' | null>(null);
  const [saved, setSaved] = useState<string[]>(readSaved);
  const [page, setPage] = useState<'home' | 'jobs' | 'saved' | 'guide' | 'plans' | 'tools' | 'tracker' | 'cv' | 'journal' | 'directory' | 'account' | 'admin-alerts' | 'immigration' | 'cover' | 'planner' | 'chat'>(initialBrowse ? 'jobs' : 'home');
  const [modal, setModal] = useState<'alerts' | 'about' | null>(null);
  const [alertEmail, setAlertEmail] = useState('');
  const [alertSaved, setAlertSaved] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const adminAlerts = useAdminAlerts(session);
  const [access, setAccess] = useState<{userId:string; member:boolean; jobHunt:boolean; error:boolean}|null>(null);
  useEffect(() => {
    let live = true;
    setAccess(null);
    if (!session || !directoryClient) return () => { live = false; };
    const userId = session.user.id;
    const check = async () => {
      try {
        const [member, jobHunt] = await Promise.all([directoryClient!.rpc('can_access_member_insights'), directoryClient!.rpc('can_access_job_hunt')]);
        if (member.error || jobHunt.error) throw new Error('Access check failed');
        if (live) setAccess({userId, member:member.data === true, jobHunt:jobHunt.data === true, error:false});
      } catch { if (live) setAccess({userId, member:false, jobHunt:false, error:true}); }
    };
    void check();
    const timer=window.setInterval(() => void check(),60000);
    window.addEventListener('focus',check);
    return () => { live=false; window.clearInterval(timer); window.removeEventListener('focus',check); };
  }, [session?.user.id]);
  const accessForSession = session && access?.userId === session.user.id ? access : null;
  const hasMemberAccess = !!accessForSession?.member;

  const [chatUnread, setChatUnread] = useState<{user:string;count:number}|null>(null);
  useEffect(() => { if(!session||!directoryClient){setChatUnread(null);return;} let active=true;
    const refreshChat=async()=>{try{const {data,error}=await directoryClient!.rpc('chat_inbox');if(active&&!error)setChatUnread({user:session.user.id,count:(data||[]).filter((thread:{unread:boolean})=>thread.unread).length});}catch{/* Chat will retry on the next refresh. */}};
    void refreshChat();const timer=window.setInterval(()=>void refreshChat(),15000);window.addEventListener('focus',refreshChat);
    return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',refreshChat)};
  },[session?.user.id]);
  useEffect(() => { if (!directoryClient) return; let live = true; directoryClient.auth.getSession().then(({data}) => { if (live && data.session) { setSession(data.session); if (!isPublicJournalHash() && !browseFromSearch(window.location.search) && window.location.hash !== '#scotland-jobs') { setShowLanding(false); setPage('account'); } } }); const {data} = directoryClient.auth.onAuthStateChange((event, next) => { if (!live) return; setSession(next); if (event === 'PASSWORD_RECOVERY') { setRecovering(true); setShowLanding(false); setPage('account'); } if (event === 'SIGNED_OUT') { setRecovering(false); setShowLanding(true); setPage('home'); } if (event === 'SIGNED_IN' && next && !isPublicJournalHash() && !browseFromSearch(window.location.search) && window.location.hash !== '#scotland-jobs') { setShowLanding(false); setPage('account'); } }); return () => { live = false; data.subscription.unsubscribe(); }; }, []);
  useEffect(() => { try { localStorage.setItem(SAVED_JOBS_KEY, JSON.stringify(saved)); } catch { /* Browser storage may be unavailable. */ } }, [saved]);
  const toggleSaved = (id: string) => setSaved(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  const clearBrowse = () => { setBrowseSelection(null); if (browseFromSearch(window.location.search)) window.history.replaceState(null, '', clearBrowseUrl(window.location.href)); };
  const navigate = (next: typeof page, signup = false) => { setAccountSignup(signup); clearBrowse(); if (next !== 'journal' && isPublicJournalHash()) window.history.replaceState(null, '', window.location.pathname + window.location.search); setPage(next); setMobileMenu(false); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const isListings = page === 'jobs' || page === 'saved';
  const openDemo = (destination: 'home' | 'jobs' | 'tools' | 'tracker' = 'home') => { setAccessModal(null); if(destination === 'jobs'){ setShowLanding(true); window.location.hash='scotland-jobs'; window.requestAnimationFrame(() => document.getElementById('scotland-jobs')?.scrollIntoView({behavior:'smooth'})); return; } setShowLanding(false); navigate(destination === 'home' ? 'account' : destination); };
  const openLanding = () => { if (browseFromSearch(window.location.search)) window.history.pushState(null, '', clearBrowseUrl(window.location.href)); setBrowseSelection(null); setMobileMenu(false); setShowLanding(true); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const openBrowse = (selection: BrowseSelection) => { setAccessModal(null); setShowLanding(true); setMobileMenu(false); window.history.pushState(null, '', browseHref(selection)); setBrowseSelection(selection); };
  useEffect(() => { const onPop = () => { const selection = browseFromSearch(window.location.search); setBrowseSelection(selection); setShowLanding(true); setPage(selection ? 'jobs' : 'home'); setMobileMenu(false); }; window.addEventListener('popstate', onPop); return () => window.removeEventListener('popstate', onPop); }, []);
  useEffect(() => { if (!showLanding || !browseSelection) return; const frame = window.requestAnimationFrame(() => { const feed = document.getElementById('scotland-jobs'); feed?.scrollIntoView({ behavior: 'smooth', block: 'start' }); feed?.focus({ preventScroll: true }); }); return () => window.cancelAnimationFrame(frame); }, [showLanding, page, browseSelection]);
  const accountView = <AccountCenter key={accountSignup ? 'signup' : 'signin'} startInSignup={accountSignup} session={session} recovering={recovering} onRecoveryComplete={() => setRecovering(false)} goDirectory={() => navigate('directory')} goCv={() => navigate('cv')} goTools={() => navigate('tools')} goJournal={() => navigate('journal')} goAlerts={() => navigate('admin-alerts')} goInsights={() => navigate('immigration')} goCover={() => navigate('cover')} goPlanner={() => navigate('planner')}/>;
  return <>
    {showLanding && <PublicLanding jobFeed={<PartnerJobs isAdmin={adminAlerts.isAdmin} loggedIn={!!session} onSignIn={() => {setShowLanding(false); navigate('account');}} browseSelection={browseSelection} onClearBrowse={clearBrowse} savedIds={saved} onToggleSaved={toggleSaved}/>} onChat={() => {setShowLanding(false); navigate('chat');}} isAdmin={adminAlerts.isAdmin} loggedIn={!!session} onBrowse={openBrowse} onDemo={openDemo} onMembership={() => setAccessModal('membership')} onSignIn={() => { setShowLanding(false); navigate('account'); }}/>}
    {!showLanding && !hasMemberAccess && <div className="member-gate-shell"><button className="directory-secondary" onClick={openLanding}>← Website home</button>{session && !accessForSession && !recovering ? <div className="directory-status">Checking your membership…</div> : <>{accessForSession?.error && <div className="directory-error" role="alert">Could not verify membership. Please refresh and try again.</div>}{accountView}</>}</div>}
    {!showLanding && hasMemberAccess && <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
      <button className="brand" onClick={openLanding} aria-label="ScotSponsor homepage"><span className="brand-mark" aria-hidden="true"><span className="saltire"/></span><span>scot<span className="brand-accent">sponsor</span><small>OPPORTUNITY, ROOTED IN SCOTLAND</small></span></button>
      <div className="side-label">DISCOVER</div>
      <nav className="side-nav" aria-label="Main navigation">
        {adminAlerts.isAdmin && <button className={page === 'home' ? 'active' : ''} onClick={() => navigate('home')}><Home size={18}/> Dashboard <ChevronRight className="nav-chevron" size={16}/></button>}
        <button className={page === 'chat' ? 'active' : ''} onClick={() => navigate('chat')}><MessageCircle size={18}/> Chat {session&&chatUnread?.user===session.user.id&&chatUnread.count>0?<span className="nav-count">{chatUnread.count}</span>:<ChevronRight className="nav-chevron" size={16}/>}</button>
        <button className={page === 'jobs' ? 'active' : ''} onClick={() => navigate('jobs')}><LayoutDashboard size={18}/> Explore jobs <ChevronRight className="nav-chevron" size={16}/></button>
        <button className={page === 'saved' ? 'active' : ''} onClick={() => navigate('saved')}><Bookmark size={18}/> Saved jobs {saved.length > 0 && <span className="nav-count">{saved.length}</span>}</button>
        <button className={page === 'guide' ? 'active' : ''} onClick={() => navigate('guide')}><GraduationCap size={19}/> Visa resources</button>
        <button className={page === 'journal' ? 'active' : ''} onClick={() => navigate('journal')}><BookOpen size={18}/> Career journal</button>
        <button className={page === 'tools' ? 'active' : ''} onClick={() => navigate('tools')}><Calculator size={18}/> Calculators</button>
        <button className={page === 'tracker' ? 'active' : ''} onClick={() => navigate('tracker')}><ClipboardList size={18}/> Application tracker</button>
        <button className={page === 'cover' ? 'active' : ''} onClick={() => navigate('cover')}><Sparkles size={18}/> AI cover letter <span className="premium-label">MEMBERS</span></button>
        <button className={page === 'planner' ? 'active' : ''} onClick={() => navigate('planner')}><GraduationCap size={18}/> Visa switch planner <span className="premium-label">MEMBERS</span></button>
        <button className={page === 'cv' ? 'active' : ''} onClick={() => navigate('cv')}><FileText size={18}/> CV studio <span className="premium-label">PREVIEW</span></button>
        <button className={page === 'directory' ? 'active' : ''} onClick={() => navigate('directory')}><Building2 size={18}/> Sponsor directory <span className="premium-label">MEMBERS</span></button>
        <button className={page === 'immigration' ? 'active' : ''} onClick={() => navigate('immigration')}><BookOpen size={18}/> Visa &amp; salary insights <span className="premium-label">MEMBERS</span></button>
      </nav>
      <div className="side-label second">YOUR ACCOUNT</div>
      <nav className="side-nav" aria-label="Account navigation"><button className={page === 'account' ? 'active' : ''} onClick={() => navigate('account')}><ShieldCheck size={18}/> My account</button>
        <button onClick={() => setAccessModal('membership')}><Bell size={18}/> Job alerts <span className="premium-label">PLANNED</span></button>
        <button className={page === 'plans' ? 'active' : ''} onClick={() => navigate('plans')}><Sparkles size={18}/> Plans & pricing</button>
      </nav>
      <div className="sidebar-bottom"><div className="side-card"><div className="side-card-icon"><Sparkles size={17}/></div><strong>Find your place in Scotland.</strong><p>Find the right opportunities for your next chapter in Scotland.</p><button onClick={() => navigate('guide')}>Explore resources <ArrowRight size={14}/></button></div><button className="help-link" onClick={() => setModal('about')}><HelpCircle size={17}/> About this project</button></div>
    </aside>
    {mobileMenu && <button className="mobile-overlay" onClick={() => setMobileMenu(false)} aria-label="Close menu"/>}
    <div className="main-area">
      <header className="topbar"><button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={21}/></button><div className="breadcrumb">Discover <ChevronRight size={14}/> <strong>{page === 'home' ? 'Home' : page === 'jobs' ? 'Explore jobs' : page === 'saved' ? 'Saved jobs' : page === 'guide' ? 'Visa resources' : page === 'tools' ? 'Calculators' : page === 'tracker' ? 'Application tracker' : page === 'cv' ? 'CV studio' : page === 'journal' ? 'Career journal' : page === 'directory' ? 'Sponsor directory' : page === 'account' ? 'My account' : page === 'chat' ? 'Chat' : page === 'admin-alerts' ? 'Admin alerts' : page === 'immigration' ? 'Visa & salary insights' : page === 'cover' ? 'AI cover letter' : page === 'planner' ? 'Graduate visa planner' : 'Plans & pricing'}</strong></div><div className="top-actions"><button className="back-to-website" onClick={openLanding}>Website home</button><span className="demo-pill"><span/> {session ? 'MEMBER ACCOUNT' : 'DEMO WORKSPACE'}</span><button className="icon-button top-bell" onClick={() => adminAlerts.isAdmin ? navigate('admin-alerts') : setAccessModal('membership')} aria-label={adminAlerts.isAdmin ? `Admin alerts${adminAlerts.feed?.unread ? `, ${adminAlerts.feed.unread} unread` : ''}` : 'Job alerts'}><Bell size={19}/>{adminAlerts.isAdmin && !!adminAlerts.feed?.unread && <span className="admin-bell-count">{adminAlerts.feed.unread > 99 ? '99+' : adminAlerts.feed.unread}</span>}</button><button className="avatar" onClick={() => navigate('account')} aria-label="My account">S</button></div></header>
      <main className="content">
        {page === 'home' ? (adminAlerts.isAdmin ? <><HomePage navigate={navigate} savedCount={saved.length}/>{!showLanding&&<PartnerJobs isAdmin={adminAlerts.isAdmin} loggedIn={!!session} onSignIn={()=>navigate('account')} savedIds={saved} onToggleSaved={toggleSaved}/>}</> : accountView) : page === 'tools' ? <ToolsPage userId={session!.user.id}/> : page === 'tracker' ? <TrackerPage/> : page === 'cv' ? (accessForSession?.jobHunt ? <CvStudio/> : <div className="directory-gate"><h2>Job Hunt Pass required</h2><p>CV Studio is available with an active Job Hunt Pass.</p><button className="directory-primary" onClick={() => setAccessModal('membership')}>View membership</button></div>) : page === 'journal' ? <Journal/> : page === 'directory' ? <SponsorDirectory onMembership={() => setAccessModal('membership')}/> : page === 'chat' ? (session&&!adminAlerts.roleReady ? <div className="directory-gate">{adminAlerts.roleError ? <>Unable to verify your account. Please reload and try again.</> : <>Checking your account…</>}</div> : <MemberChat key={session?.user.id||'guest'} session={session} isAdmin={adminAlerts.isAdmin} onSignIn={()=>navigate('account')}/>) : page === 'account' ? accountView : page === 'cover' || page === 'planner' ? <MemberTools key={page} kind={page} session={session} onAccount={() => navigate('account')} onMembership={() => setAccessModal('membership')}/> : page === 'immigration' ? <ImmigrationInsights session={session} onAccount={() => navigate('account')} onMembership={() => setAccessModal('membership')}/> : page === 'admin-alerts' ? (adminAlerts.isAdmin ? <AdminAlerts feed={adminAlerts.feed} error={adminAlerts.error} refresh={adminAlerts.refresh}/> : <div className="directory-gate">Super-admin access is required.</div>) : isListings ? <>
          <section className="hero"><div className="hero-content"><div className="eyebrow"><span className="eyebrow-dot"/> YOUR NEXT CHAPTER STARTS HERE</div><h1>{page === 'saved' ? <>Your opportunities,<br/><em>all in one place.</em></> : <>A brighter career<br/><em>across Scotland.</em></>}</h1><p>{page === 'saved' ? 'Keep track of the roles that caught your eye and come back whenever you’re ready.' : 'Discover opportunities, understand sponsorship, and take the next step with a little more confidence.'}</p><div className="hero-foot"><span className="hero-saltire" aria-hidden="true"><span className="saltire"/></span><span>Made for your future in Scotland</span></div></div><div className="hero-art" aria-hidden="true"><div className="art-label"><span>✦</span> MADE IN SCOTLAND, FOR YOUR FUTURE</div></div></section>
          <PartnerJobs isAdmin={adminAlerts.isAdmin} loggedIn={!!session} onSignIn={()=>navigate('account')} browseSelection={browseSelection} onClearBrowse={clearBrowse} savedIds={saved} onToggleSaved={toggleSaved} savedOnly={page === 'saved'}/>
        </> : page === 'guide' ? <section className="secondary-page"><div className="section-kicker">A LITTLE GUIDANCE GOES A LONG WAY <span>✳</span></div><h1>Make your next move<br/><em>with confidence.</em></h1><p className="page-intro">Finding a sponsored role can feel complicated. Start with the official resources, ask questions, and take it one step at a time.</p><div className="guide-grid"><article><div className="guide-icon"><ShieldCheck/></div><h3>Check the sponsor register</h3><p>A sponsor licence is a useful starting point, but it does not mean every role at that organisation offers sponsorship.</p><a href="https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers" target="_blank" rel="noreferrer">View official register <ExternalLink size={15}/></a></article><article><div className="guide-icon"><GraduationCap/></div><h3>Understand the Skilled Worker visa</h3><p>Eligibility depends on your circumstances, occupation, salary and the rules in force when you apply.</p><a href="https://www.gov.uk/skilled-worker-visa" target="_blank" rel="noreferrer">Read the official guidance <ExternalLink size={15}/></a></article><article><div className="guide-icon"><Briefcase/></div><h3>Ask the right questions</h3><p>Ask the employer whether the specific role offers sponsorship, whether it meets the relevant requirements, and what their process looks like.</p><button onClick={() => navigate('jobs')}>Explore jobs <ArrowRight size={15}/></button></article></div><div className="guide-note"><Info size={19}/><p><strong>A note on eligibility</strong><br/>Immigration rules change and exceptions can apply. ScotSponsor does not provide immigration advice or determine visa eligibility. Consult GOV.UK or a qualified adviser for your circumstances.</p></div></section> : <section className="secondary-page"><div className="section-kicker">SIMPLE, THOUGHTFUL SUPPORT <span>✳</span></div><h1>More support for<br/><em>your job hunt.</em></h1><p className="page-intro">A look at the products in the ScotSponsor roadmap. Payments and paid access are not connected in this demo.</p><div className="pricing-grid"><article><span className="plan-label">FLEXIBLE · PLANNED</span><h3>{plans.monthly.name}</h3><div className="price">{plans.monthly.price} <small>{plans.monthly.period}</small></div><p>{plans.monthly.description}</p><ul>{plans.monthly.features.map(feature => <li key={feature}><Check size={16}/> {feature}</li>)}</ul><div className="pricing-terms">{plans.monthly.terms}</div><button onClick={() => setAccessModal('membership')}>View planned membership</button></article><article className="featured-plan"><span className="plan-label">THE 90-DAY PLAN · PLANNED</span><h3>{plans.jobHunt.name}</h3><div className="price">{plans.jobHunt.price} <small>{plans.jobHunt.period}</small></div><p>{plans.jobHunt.description}</p><ul>{plans.jobHunt.features.map(feature => <li key={feature}><Check size={16}/> {feature}</li>)}</ul><div className="pricing-terms">{plans.jobHunt.terms}</div><button onClick={() => setAccessModal('membership')}>View planned membership</button></article><article><span className="plan-label">EXTRA SUPPORT</span><h3>Visa Switching Kit</h3><div className="price">£19 <small>/ one-off</small></div><p>A planned toolkit for your job search.</p><ul><li><Check size={16}/> Planned job search resources</li><li><Check size={16}/> Planned employer outreach scripts</li><li><Check size={16}/> One-time purchase</li></ul><button disabled>Coming soon</button></article></div></section>}
        <div hidden={page !== 'home'}><InstallCard/></div>
      </main>
    </div>
    {modal && <div className="modal-backdrop" onMouseDown={() => setModal(null)}><div className="modal" role="dialog" aria-modal="true" aria-label={modal === 'alerts' ? 'Job alerts' : 'About ScotSponsor'} onMouseDown={e => e.stopPropagation()}><button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={20}/></button>{modal === 'alerts' ? <><div className="modal-icon"><Bell size={22}/></div><div className="section-kicker">STAY IN THE LOOP</div><h2>Job alerts, coming soon.</h2><p>We’re working towards helpful alerts for opportunities that fit your search. This demo cannot send email, Telegram or WhatsApp alerts yet.</p><form onSubmit={e => {e.preventDefault(); setAlertSaved(true);}}><label className="form-label" htmlFor="alert-email">Try the alert preference</label><div className="email-row"><input id="alert-email" type="email" required placeholder="you@example.com" value={alertEmail} onChange={e => {setAlertEmail(e.target.value);setAlertSaved(false);}}/><button type="submit">Preview</button></div></form>{alertSaved && <div className="form-success"><CheckCircle2 size={17}/> Preview only — your email was not submitted or saved.</div>}<p className="fine-print">No mailing list or notification service is connected.</p></> : <><div className="modal-icon"><ShieldCheck size={22}/></div><div className="section-kicker">WELCOME TO SCOTSPONSOR</div><h2>A clearer path to your next chapter.</h2><p>Explore Scottish job opportunities and sponsorship information.</p><div className="modal-warning"><Info size={17}/> Listings can change or close. Confirm sponsorship arrangements directly with the employer. Payments and member job alerts are not connected.</div><p>For current visa requirements, always refer to official GOV.UK guidance or a qualified immigration adviser.</p><button className="modal-primary" onClick={() => {setModal(null); navigate('guide');}}>Explore visa resources <ArrowRight size={15}/></button></>}</div></div>}
  </div>}
    {accessModal && <AccessModal mode={accessModal} onClose={() => setAccessModal(null)} onDemo={() => openDemo()} onMembership={() => setAccessModal('membership')} onDirectory={() => { setAccessModal(null); setShowLanding(false); navigate('directory'); }} onAccount={() => { setAccessModal(null); setShowLanding(false); navigate('account', true); }}/>}
  </>;
}
export default App;
