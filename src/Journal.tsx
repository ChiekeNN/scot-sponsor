import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Clock3, ExternalLink, Lightbulb, Search, Sparkles } from 'lucide-react';
import { guides, type Guide } from './guides';

const categories = ['All guides', 'Job search', 'CV & applications', 'Interviews', 'Working in Scotland', 'Sponsorship'] as const;
const guideFromHash = () => {
  const hash = window.location.hash;
  if (!hash.startsWith('#guide-')) return null;
  return guides.find(guide => `#guide-${guide.slug}` === hash) || null;
};

function Cover({ guide, featured = false }: { guide: Guide; featured?: boolean }) {
  return <div className={`journal-cover ${guide.accent} ${featured ? 'featured' : ''}`} aria-hidden="true"><img className="journal-cover-image" src={guide.image} alt="" loading={featured ? 'eager' : 'lazy'} decoding="async"/><div className="journal-cover-shade"/><span className="cover-star">✳</span><span className="cover-caption">SCOTSPONSOR <b> / </b> THE CAREER JOURNAL</span></div>;
}

export function Journal() {
  const [selected, setSelected] = useState<Guide | null>(guideFromHash);
  const [category, setCategory] = useState<string>('All guides');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const update = () => setSelected(guideFromHash());
    window.addEventListener('hashchange', update);
    return () => window.removeEventListener('hashchange', update);
  }, []);
  useEffect(() => {
    if (selected) document.getElementById(`guide-${selected.slug}`)?.scrollIntoView({ block: 'start' });
  }, [selected]);
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    return guides.filter(guide => (category === 'All guides' || guide.category === category) && (!term || [guide.title, guide.description, guide.category, guide.intro, ...guide.sections.flatMap(section => [section.heading, section.body, ...(section.bullets || [])])].join(' ').toLowerCase().includes(term)));
  }, [category, query]);
  return <section className="journal" id="journal" aria-label="Career journal">
    {selected ? <article className="journal-article" id={`guide-${selected.slug}`}>
      <a className="journal-back" href="#journal"><ArrowLeft size={15}/> All career guides</a>
      <div className="article-hero"><div><div className="journal-kicker">{selected.category.toUpperCase()} <span> / </span> THE CAREER JOURNAL</div><h1>{selected.title}</h1><p>{selected.description}</p><div className="article-meta"><span><BookOpen size={14}/> ScotSponsor guide</span><span><Clock3 size={14}/> {selected.reading}</span><span>{selected.reviewed ? `SOURCE CHECKED ${selected.reviewed.toUpperCase()}` : 'EVERGREEN ADVICE'}</span></div></div><Cover guide={selected} featured/></div>
      <div className="article-content"><p className="article-intro">{selected.intro}</p>{selected.sections.map(section => <section key={section.heading}><h2>{section.heading}</h2><p>{section.body}</p>{section.bullets && <ul>{section.bullets.map(bullet => <li key={bullet}>{bullet}</li>)}</ul>}</section>)}<aside className="article-takeaway"><div className="takeaway-icon"><Lightbulb size={19}/></div><div><span>A SMALL STEP TO TAKE</span><p>{selected.takeaway}</p></div></aside><section className="article-sources"><h2>Useful official resources</h2><p>For up-to-date information and further guidance, visit the sources below.</p>{selected.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} <ExternalLink size={14}/></a>)}</section><div className="article-notice">This guide provides general information, not legal, immigration or financial advice. Rules and individual circumstances can change; check official guidance or speak to a qualified adviser.</div><a className="journal-back bottom" href="#journal"><ArrowLeft size={15}/> Explore more guides</a></div>
    </article> : <><div className="journal-heading"><div><div className="journal-kicker">THOUGHTFUL ADVICE FOR THE ROAD AHEAD <span>✳</span></div><h2>Your next chapter,<br/><em>one good idea at a time.</em></h2><p>Practical career guidance and official-source explainers for your next move. Free to read, no sign-in required.</p></div><div className="journal-heading-badge"><Sparkles size={20}/><span>THE CAREER<br/><strong>JOURNAL</strong></span></div></div>
      <div className="journal-feature"><Cover guide={guides[0]} featured/><div className="journal-feature-copy"><span className="journal-overline">START HERE <span>✳</span> {guides[0].category.toUpperCase()}</span><h3>{guides[0].title}</h3><p>{guides[0].description}</p><a href={`#guide-${guides[0].slug}`}>Read the guide <ArrowRight size={16}/></a><span className="journal-feature-time"><Clock3 size={13}/> {guides[0].reading} · Evergreen guide</span></div></div>
      <div className="journal-list-heading"><div><div className="journal-kicker">GOOD ADVICE, WHEN YOU NEED IT <span>✳</span></div><h3>Explore the journal</h3><p>Choose a topic or search for what’s on your mind.</p></div><label className="journal-search"><Search size={17}/><span className="sr-only">Search career guides</span><input type="search" placeholder="Search advice..." value={query} onChange={event => setQuery(event.target.value)}/></label></div>
      <div className="journal-filters" aria-label="Filter guides by topic">{categories.map(item => <button key={item} type="button" aria-pressed={category === item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}</div>
      <div className="journal-results-count" aria-live="polite">{results.length} {results.length === 1 ? 'guide' : 'guides'} to explore</div>
      <div className="journal-grid">{results.map(guide => <article className="journal-card" key={guide.slug}><a className="journal-card-cover" href={`#guide-${guide.slug}`} tabIndex={-1} aria-hidden="true"><Cover guide={guide}/></a><div className="journal-card-content"><div className="journal-card-category">{guide.category} <span>·</span> <span>{guide.reading}</span></div><h3><a href={`#guide-${guide.slug}`}>{guide.title}</a></h3><p>{guide.description}</p><a className="journal-read" href={`#guide-${guide.slug}`}>Read guide <ArrowUpRight size={15}/></a></div></article>)}</div>
      {!results.length && <div className="journal-empty"><Search size={22}/><h3>No guides found</h3><p>Try a different search or explore all topics.</p><button onClick={() => {setQuery(''); setCategory('All guides');}}>Clear filters</button></div>}
      <div className="journal-bottom"><div className="journal-bottom-icon"><BookOpen size={19}/></div><div><strong>A little guidance goes a long way.</strong><p>These guides are editorial and do not update automatically. Always check the official sources for current rules.</p></div></div>
    </>}
  </section>;
}
