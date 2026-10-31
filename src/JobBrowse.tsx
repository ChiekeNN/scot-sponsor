import {useEffect,useState} from 'react';
import {directoryClient} from './directoryClient';
import {ArrowRight,Briefcase,MapPin,TrendingUp} from 'lucide-react';
import {browseGroups,browseHref} from './jobBrowse.mjs';
import type {BrowseKind,BrowseSelection} from './jobBrowse.mjs';

const tabs: {kind:BrowseKind;label:string;description:string}[]=[
 {kind:'industry',label:'Browse by industry',description:'Explore roles across Scotland’s sectors.'},
 {kind:'popular',label:'Browse by popular jobs',description:'Start with a role or search that interests you.'},
 {kind:'location',label:'Browse by location',description:'Find opportunities in towns, cities and regions across Scotland.'}
];
export function JobBrowse({onBrowse}:{onBrowse:(selection:BrowseSelection)=>void}){
 const [active,setActive]=useState<BrowseKind>('industry');
 const [counts,setCounts]=useState<Record<string,number>|null>(null);
 const [countStatus,setCountStatus]=useState<'loading'|'ready'|'error'>('loading');
 const [retry,setRetry]=useState(0);
 useEffect(()=>{
  let alive=true, request=0;
  async function load(){
   const current=++request;
   try{
    if(!directoryClient)throw Error('Unavailable');
    const {data,error}=await directoryClient.rpc('public_industry_job_counts',{p_categories:browseGroups.industry.map(({id,terms})=>({id,terms}))});
    if(error||!Array.isArray(data)||data.length!==browseGroups.industry.length)throw Error('Incomplete counts');
    const next:Record<string,number>={};
    for(const row of data){
     const count=Number(row?.total);
     if(typeof row?.id!=='string'||!browseGroups.industry.some(item=>item.id===row.id)||Object.prototype.hasOwnProperty.call(next,row.id)||!(typeof row.total==='number'||(typeof row.total==='string'&&/^\d+$/.test(row.total)))||!Number.isSafeInteger(count)||count<0)throw Error('Invalid counts');
     next[row.id]=count;
    }
    if(alive&&current===request){setCounts(next);setCountStatus('ready')}
   }catch{if(alive&&current===request){setCounts(null);setCountStatus('error')}}
  }
  void load();
  const timer=window.setInterval(()=>void load(),180000);
  const onFocus=()=>void load();window.addEventListener('focus',onFocus);
  return ()=>{alive=false;window.clearInterval(timer);window.removeEventListener('focus',onFocus)};
 },[retry]);
 const group=tabs.find(tab=>tab.kind===active)!;
 return <section className="job-browse" id="browse-jobs" aria-labelledby="browse-heading">
  <div className="browse-heading"><div><div className="public-kicker">FIND YOUR NEXT OPPORTUNITY <span>✳</span></div><h2 id="browse-heading">A place for every <em>ambition.</em></h2><p>Explore recent Scottish jobs by industry, role or location.</p></div><span className="browse-heading-icon" aria-hidden="true"><Briefcase size={25}/></span></div>
  <div className="browse-tabs" role="group" aria-label="Ways to browse jobs">{tabs.map(tab=><button type="button" key={tab.kind} aria-pressed={active===tab.kind} onClick={()=>setActive(tab.kind)}>{tab.kind==='location'?<MapPin size={16}/>:tab.kind==='popular'?<TrendingUp size={16}/>:<Briefcase size={16}/>} {tab.label}</button>)}</div>
  <div className="browse-panel"><div className="browse-panel-heading"><div><h3>{group.label}</h3><p>{group.description}</p></div><span>{browseGroups[active].length} ways to explore</span></div>
   {active==='industry'&&countStatus==='loading'&&<p className="browse-count-status" role="status">Loading job counts…</p>}{active==='industry'&&countStatus==='error'&&<p className="browse-count-status" role="status">Job counts are temporarily unavailable. <button type="button" onClick={()=>{setCountStatus('loading');setRetry(n=>n+1)}}>Try again</button></p>}
   <ul className={`browse-links browse-links-${active}`}>{browseGroups[active].map(choice=>{const selection={kind:active,id:choice.id};return <li key={choice.id}><a href={browseHref(selection)} onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();onBrowse(selection)}}><span>{choice.label}</span><span className="browse-link-end">{active==='industry'&&counts&&<span className="browse-job-count">{counts[choice.id].toLocaleString('en-GB')} {counts[choice.id]===1?'job':'jobs'}</span>}<ArrowRight size={15} aria-hidden="true"/></span></a></li>})}</ul>
   <p className="browse-note">Searches use keywords in available listings, so results can overlap or miss relevant jobs. Listings and availability change.</p>
  </div>
 </section>;
}
