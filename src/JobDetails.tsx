import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {directoryClient} from './directoryClient';
import {descriptionBlocks} from './jobDescription.mjs';

type Detail={id:string;title:string;employer:string;location:string;posted_at:string;excerpt:string;full_description:string|null;salary_min:number|null;salary_max:number|null;salary_is_predicted:boolean|null;salary_period:string|null;expires_at:string|null;contract_type:string|null;contract_time:string|null};
type Props={id:string;title:string;isAdmin?:boolean;onClose:()=>void};
const text=(s:string)=>s.replace(/\bsponsorship\s+(?:is\s+)?not\s+verified\b/gi,'Please confirm sponsorship arrangements with the employer');
const money=(v:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(v);
function salary(d:Detail){const min=d.salary_min,max=d.salary_max;if(min==null&&max==null){const supplied=/^Salary:\s*(.+)$/m.exec(d.full_description||'');return supplied?.[1]?.trim()||'Not provided'};const value=min!=null&&max!=null?(min===max?money(min):`${money(min)} – ${money(max)}`):min!=null?`From ${money(min)}`:`Up to ${money(max!)}`;return `${value}${d.salary_is_predicted?' · estimate':''} · ${d.salary_period?`per ${d.salary_period}`:'pay period not specified'}`}
function label(v:string|null){return v?v.replace(/_/g,' ').replace(/^\w/,c=>c.toUpperCase()):'Not provided'}

function Emphasis({value}:{value:string}){return <>{value.split(/(\*\*[^*\n]+\*\*)/g).map((part,index)=>part.startsWith('**')&&part.endsWith('**')?<strong key={index}>{part.slice(2,-2)}</strong>:part)}</>}
function Description({value}:{value:string}){return <div className="job-detail-description">{descriptionBlocks(text(value)).map((block,index)=>block.type==='heading'?<h4 key={index}><Emphasis value={block.text}/></h4>:block.type==='list'?<ul key={index}>{block.items.map((item,i)=><li key={i}><Emphasis value={item}/></li>)}</ul>:<p key={index}><Emphasis value={block.text}/></p>)}</div>}

function FullDescriptionEditor({id,description,onSaved}:{id:string;description:string;onSaved:()=>void}){
 const [value,setValue]=useState(description);const [confirmed,setConfirmed]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
 async function save(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy)return;setBusy(true);setMessage('');
  try{
   if(!directoryClient)throw new Error('Client unavailable');
   const {error}=await directoryClient.rpc('admin_save_job_full_description',{p_job_id:id,p_description:value,p_confirm:confirmed});
   if(error)throw error;
   setMessage('Full description saved.');setConfirmed(false);onSaved();
  }catch{setMessage('Unable to save the description. Check that the job is still available and you are signed in as a super-admin, then try again.');}
  finally{setBusy(false)}
 }
 return <details className="job-admin-editor"><summary>Super-admin: add or update full description</summary><form onSubmit={save}><p>Changes to this description will be visible to everyone viewing this job.</p><label>Full job description<textarea required minLength={20} maxLength={30000} rows={12} value={value} onChange={event=>setValue(event.target.value)}/></label><label className="support-consent"><input type="checkbox" required checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/> I confirm this description is complete, current and authorised for publication.</label><button type="submit" className="support-button" disabled={busy}>{busy?'Saving…':'Save full description'}</button>{message&&<p role="status">{message}</p>}</form></details>;
}

export function JobDetails({id,title,isAdmin=false,onClose}:Props){
 const [detail,setDetail]=useState<Detail|null>(null);const [error,setError]=useState(false);const [loading,setLoading]=useState(true);const [refresh,setRefresh]=useState(0);const box=useRef<HTMLDivElement>(null);const closeButton=useRef<HTMLButtonElement>(null);
 useEffect(()=>{let alive=true;setLoading(true);(async()=>{try{const {data,error:rpcError}=await directoryClient!.rpc('public_job_detail',{p_job_id:id});if(alive){setDetail(data?.full_description ? data as Detail : null);setError(!!rpcError||!data?.full_description);setLoading(false)}}catch{if(alive){setError(true);setLoading(false)}}})();return()=>{alive=false}},[id,refresh]);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';closeButton.current?.focus();const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();onClose()}else if(e.key==='Tab'&&box.current){const items=Array.from(box.current.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),summary,[href]')).filter(el=>el.getClientRects().length>0);if(!items.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}};document.addEventListener('keydown',key);return()=>{document.removeEventListener('keydown',key);document.body.style.overflow=oldOverflow;previous?.focus()}},[onClose]);
 return <div className="job-detail-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="job-detail-modal" role="dialog" aria-modal="true" aria-labelledby="job-detail-title" ref={box}><button ref={closeButton} className="job-detail-close" type="button" onClick={onClose} aria-label="Close job details"><X size={20}/></button><div className="section-kicker">SCOTTISH OPPORTUNITY</div><h2 id="job-detail-title">{text(detail?.title||title)}</h2>{loading&&<p role="status">Loading job details…</p>}{error&&<p role="alert">This job is no longer available or its details could not be loaded.</p>}{detail&&<><p className="job-detail-company">{text(detail.employer||'Employer not specified')} · {text(detail.location)}</p><div className="job-detail-facts"><div><span>Posted</span><strong>{new Date(detail.posted_at).toLocaleDateString('en-GB',{dateStyle:'medium'})}</strong></div>{detail.expires_at&&<div><span>Closes</span><strong>{new Date(detail.expires_at).toLocaleDateString('en-GB',{dateStyle:'medium',timeZone:'UTC'})}</strong></div>}<div><span>Salary</span><strong>{salary(detail)}</strong></div><div><span>Contract</span><strong>{label(detail.contract_type)}</strong></div><div><span>Working pattern</span><strong>{label(detail.contract_time)}</strong></div></div><h3>Job description</h3>{detail.full_description&&<Description value={detail.full_description}/>}{isAdmin&&detail.full_description&&<FullDescriptionEditor id={id} description={detail.full_description} onSaved={()=>setRefresh(n=>n+1)}/>}</>}</div></div>;
}
