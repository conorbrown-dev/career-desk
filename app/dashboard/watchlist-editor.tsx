'use client';
import {useState} from 'react';
import {Plus,RefreshCw,Trash2,AlertCircle,Check,Rss} from 'lucide-react';
import {boardHelp,boardKey,boardPageUrl,defaultBoardName,parseBoardInput,providerLabels,watchlistLimits,type Provider,type SourceStatus} from '@/lib/job-boards';
import {catalog,catalogCheckedOn,companyBySlug,focusLabels,packs,suggestCompanies,type CatalogCompany} from '@/lib/company-catalog';
import {checkBoards} from './discovery-panel';
import {addedMessage,saveWatchlist,withCompanies,type Settings} from './watchlist-client';

type EditableBoard={provider:Provider;slug:string;name:string;unsaved?:boolean}&SourceStatus;

function status(b:EditableBoard){
 if(b.unsaved)return 'Not saved yet';
 if(b.lastError)return b.lastError;
 if(b.lastCheckedAt)return `${b.lastOpen??0} open · ${b.lastAdded??0} added last check · ${new Date(b.lastCheckedAt).toLocaleDateString()}`;
 if(b.lastOpen!==undefined)return `${b.lastOpen} open roles · first check pending`;
 return 'First check pending';
}
function CompanyRow({c,watching,busy,onAdd}:{c:CatalogCompany;watching:boolean;busy:boolean;onAdd:()=>void}){
 return <li><div><strong>{c.name}</strong><small>{providerLabels[c.provider]} · {c.focus.map(f=>focusLabels[f]).join(', ')}{c.remoteUS?' · US-remote listings':''}</small></div>
  {watching?<span className="watching"><Check size={14}/>Watching</span>:<button className="secondary" type="button" disabled={busy} onClick={onAdd}><Plus size={14}/>Add</button>}</li>;
}

export default function WatchlistEditor({watchlist,profile,demo,notify,reload}:{watchlist:any;profile:any;demo:boolean;notify:(m:string)=>void;reload:()=>Promise<void>}){
 const roles=String(profile?.criteria?.roles||'');
 const [boards,setBoards]=useState<EditableBoard[]>(watchlist?.boards||[]);
 const [keywords,setKeywords]=useState<string>(watchlist?.keywords||''),[exclude,setExclude]=useState<string>(watchlist?.exclude||'');
 const [remoteOnly,setRemoteOnly]=useState<boolean>(!!watchlist?.remoteOnly);
 const [remotive,setRemotive]=useState<boolean>(!!watchlist?.feeds?.remotive);
 const [link,setLink]=useState(''),[name,setName]=useState(''),[linkError,setLinkError]=useState('');
 const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false);
 const edit=<T,>(set:(v:T)=>void)=>(v:T)=>{set(v);setDirty(true)};
 const watched=new Set(boards.map(boardKey));
 const suggested=suggestCompanies(profile,boards,8);
 const remotiveStatus:SourceStatus|undefined=watchlist?.feedStatus?.remotive;
 const settings=(over:Partial<Settings>={}):Settings=>({boards:boards.map(({provider,slug,name})=>({provider,slug,name})),keywords,exclude,remoteOnly,feeds:{remotive},...over});
 async function persist(next:Settings,skipUnreadable:boolean,message:(d:any)=>string){
  if(demo){notify('Job sources are available in a connected account.');return}
  setBusy(true);
  try{const d=await saveWatchlist(next,skipUnreadable);setBoards(d.boards);setRemotive(!!d.feeds?.remotive);setDirty(false);await reload();notify(message(d))}
  catch(e){notify(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 function addCompanies(companies:CatalogCompany[]){
  const {settings:next,added,full}=withCompanies(settings(),companies);
  if(!added){notify(full?`You can watch up to ${watchlistLimits.boards} boards.`:'Already watching those companies.');return}
  void persist(next,true,d=>addedMessage(added,d.skipped,full));
 }
 function add(){
  setLinkError('');
  try{
   const b=parseBoardInput(link);
   if(watched.has(boardKey(b))){setLinkError('That board is already on your list.');return}
   if(boards.length>=watchlistLimits.boards){setLinkError(`You can watch up to ${watchlistLimits.boards} boards.`);return}
   setBoards([...boards,{...b,name:name.trim()||companyBySlug(b.slug)?.name||defaultBoardName(b.slug),unsaved:true}]);setLink('');setName('');setDirty(true);
  }catch(e){setLinkError(e instanceof Error?e.message:boardHelp)}
 }
 async function check(){
  if(demo){notify('Job source checks are available in a connected account.');return}
  setBusy(true);try{await checkBoards(notify,reload)}catch(e){notify(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 return <section className="panel watchlist" id="job-boards" aria-labelledby="job-boards-heading">
  <div className="section-top"><div><span className="eyebrow">AUTOMATIC JOB SOURCES</span><h2 id="job-boards-heading">Choose where new roles come from.</h2></div></div>
  <p className="muted">Every morning Career Desk checks the companies and feeds you pick and adds new roles whose title matches your target roles{roles?<> (<strong>{roles}</strong>)</>:null} or the extra keywords below. They arrive as Discovered for you to review. Nothing is applied for.</p>

  {suggested.length>0&&<div className="source-group">
   <div className="source-group-head"><h3>Suggested for your target roles</h3><button className="primary" type="button" disabled={busy} onClick={()=>addCompanies(suggested)}><Plus size={15}/>Add all {suggested.length}</button></div>
   <ul className="company-list">{suggested.map(c=><CompanyRow key={c.slug} c={c} watching={false} busy={busy} onAdd={()=>addCompanies([c])}/>)}</ul>
  </div>}

  <div className="source-group">
   <h3>Company packs</h3>
   <div className="pack-grid">{packs.map(p=>{const members=p.slugs.map(companyBySlug).filter(Boolean) as CatalogCompany[],left=members.filter(c=>!watched.has(boardKey(c)));
    return <div className="pack" key={p.id}><strong>{p.name}</strong><p>{p.description}</p><small>{members.map(c=>c.name).join(', ')}</small>
     {left.length?<button className="secondary" type="button" disabled={busy} onClick={()=>addCompanies(left)}><Plus size={14}/>Add {left.length===members.length?'all '+members.length:left.length+' more'}</button>:<span className="watching"><Check size={14}/>All added</span>}</div>})}</div>
  </div>

  <details className="source-group catalog">
   <summary>Browse all {catalog.length} companies</summary>
   <ul className="company-list">{catalog.map(c=><CompanyRow key={c.slug} c={c} watching={watched.has(boardKey(c))} busy={busy} onAdd={()=>addCompanies([c])}/>)}</ul>
   <p className="catalog-note">Boards were confirmed live and remote labels taken from their listings on {new Date(catalogCheckedOn+'T12:00:00').toLocaleDateString()}. Companies change careers sites; a board that stops answering is flagged below.</p>
  </details>

  <div className="source-group">
   <h3>Job feeds</h3>
   <label className="feed-toggle"><input type="checkbox" checked={remotive} disabled={busy} onChange={e=>{const on=e.target.checked;void persist(settings({feeds:{remotive:on}}),false,()=>on?'Remotive feed on. Matching remote roles arrive with the next check.':'Remotive feed off.')}}/>
    <span><strong><Rss size={14}/> Remote jobs from <a href="https://remotive.com" target="_blank" rel="noreferrer">Remotive</a></strong>
     <small>Thousands of remote roles across many companies. Listings appear about a day after posting{/\b(us|usa|united states)\b/i.test(String(profile?.criteria?.remote||''))?'; only roles open to US-based applicants are added':''}. Added roles link to the job on Remotive.</small>
     {remotive&&remotiveStatus?.lastCheckedAt&&<small className={remotiveStatus.lastError?'board-error':''}>{remotiveStatus.lastError||`${remotiveStatus.lastOpen??0} roles checked · ${remotiveStatus.lastAdded??0} added last check`}</small>}</span>
   </label>
  </div>

  <div className="source-group">
   <h3>Your companies {boards.length>0&&<span className="optional">({boards.length}/{watchlistLimits.boards})</span>}</h3>
   {boards.length?<ul className="board-list">{boards.map(b=><li key={boardKey(b)}>
    <div><strong>{b.name}</strong><a href={boardPageUrl(b)} target="_blank" rel="noreferrer">{providerLabels[b.provider]} · {b.slug}</a><small className={b.lastError&&!b.unsaved?'board-error':''}>{b.lastError&&!b.unsaved&&<AlertCircle size={13}/>}{status(b)}</small></div>
    <button className="icon-button" type="button" aria-label={'Stop watching '+b.name} onClick={()=>{setBoards(boards.filter(x=>boardKey(x)!==boardKey(b)));setDirty(true)}}><Trash2 size={15}/></button>
   </li>)}</ul>:<p className="empty-boards">No companies yet. Add suggestions above or paste a careers link.</p>}
   <div className="watchlist-add">
    <label>Another company’s careers link<input value={link} onChange={e=>setLink(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add()}}} placeholder="https://jobs.lever.co/company" aria-invalid={!!linkError}/></label>
    <label>Company name <span className="optional">(optional)</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Shown on added roles" maxLength={200}/></label>
    <button className="secondary" type="button" onClick={add} disabled={!link.trim()}><Plus size={15}/>Add board</button>
   </div>
   {linkError&&<p className="field-error" role="alert">{linkError}</p>}
  </div>

  <div className="watchlist-filters">
   <label>Extra title keywords <span className="optional">(comma-separated)</span><input value={keywords} onChange={e=>edit(setKeywords)(e.target.value)} placeholder="e.g. senior software engineer, senior backend engineer" maxLength={2000}/></label>
   <label>Skip titles containing <span className="optional">(comma-separated)</span><input value={exclude} onChange={e=>edit(setExclude)(e.target.value)} placeholder="e.g. intern, manager, contract" maxLength={2000}/></label>
   <p className="filter-hint">A title matches when it contains every word of one target role or keyword, so “Staff Backend Engineer” won’t catch “Senior Backend Engineer”. Add each variant you want.</p>
   <label className="check"><input type="checkbox" checked={remoteOnly} onChange={e=>edit(setRemoteOnly)(e.target.checked)}/>Only add company roles the board lists as remote</label>
  </div>
  <div className="watchlist-actions">
   <button className="secondary" type="button" disabled={busy||dirty||(!boards.length&&!remotive)} onClick={check} title={dirty?'Save your changes first':undefined}><RefreshCw size={15}/>Check now</button>
   <button className="primary" type="button" disabled={busy||!dirty} onClick={()=>void persist(settings(),false,()=>'Job sources saved.')}>{busy?'Working…':'Save changes'}</button>
  </div>
 </section>;
}
