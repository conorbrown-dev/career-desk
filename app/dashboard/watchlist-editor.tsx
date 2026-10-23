'use client';
import {useState} from 'react';
import {Plus,RefreshCw,Trash2,AlertCircle} from 'lucide-react';
import {boardHelp,boardKey,boardPageUrl,defaultBoardName,parseBoardInput,providerLabels,watchlistLimits,type Provider} from '@/lib/job-boards';
import {checkBoards} from './discovery-panel';

type EditableBoard={provider:Provider;slug:string;name:string;lastCheckedAt?:string;lastOpen?:number;lastAdded?:number;lastError?:string;unsaved?:boolean};

function status(b:EditableBoard){
 if(b.unsaved)return 'Not saved yet';
 if(b.lastError)return b.lastError;
 if(b.lastCheckedAt)return `${b.lastOpen??0} open · ${b.lastAdded??0} added last check · ${new Date(b.lastCheckedAt).toLocaleDateString()}`;
 if(b.lastOpen!==undefined)return `${b.lastOpen} open roles · first check pending`;
 return 'First check pending';
}

export default function WatchlistEditor({watchlist,roles,demo,notify,reload}:{watchlist:any;roles:string;demo:boolean;notify:(m:string)=>void;reload:()=>Promise<void>}){
 const [boards,setBoards]=useState<EditableBoard[]>(watchlist?.boards||[]);
 const [keywords,setKeywords]=useState<string>(watchlist?.keywords||''),[exclude,setExclude]=useState<string>(watchlist?.exclude||'');
 const [remoteOnly,setRemoteOnly]=useState<boolean>(!!watchlist?.remoteOnly);
 const [link,setLink]=useState(''),[name,setName]=useState(''),[linkError,setLinkError]=useState('');
 const [dirty,setDirty]=useState(false),[busy,setBusy]=useState(false);
 const edit=<T,>(set:(v:T)=>void)=>(v:T)=>{set(v);setDirty(true)};
 function add(){
  setLinkError('');
  try{
   const b=parseBoardInput(link);
   if(boards.some(x=>boardKey(x)===boardKey(b))){setLinkError('That board is already on your list.');return}
   if(boards.length>=watchlistLimits.boards){setLinkError(`You can watch up to ${watchlistLimits.boards} boards.`);return}
   setBoards([...boards,{...b,name:name.trim()||defaultBoardName(b.slug),unsaved:true}]);setLink('');setName('');setDirty(true);
  }catch(e){setLinkError(e instanceof Error?e.message:boardHelp)}
 }
 async function save(){
  if(demo){notify('Job board watching is available in a connected account.');return}
  setBusy(true);
  try{
   const r=await fetch('/api/discovery',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({boards:boards.map(({provider,slug,name})=>({provider,slug,name})),keywords,exclude,remoteOnly})});
   const d:any=await r.json();if(!r.ok)throw Error(d.error||'Could not save your job boards.');
   setBoards(d.boards);setDirty(false);await reload();notify('Job boards saved.');
  }catch(e){notify(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 async function check(){
  if(demo){notify('Job board checks are available in a connected account.');return}
  setBusy(true);try{await checkBoards(notify,reload)}catch(e){notify(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
 }
 return <section className="panel watchlist" id="job-boards" aria-labelledby="job-boards-heading">
  <div className="section-top"><div><span className="eyebrow">COMPANY JOB BOARDS</span><h2 id="job-boards-heading">Watch the companies you want.</h2></div></div>
  <p className="muted">Paste a company’s careers link from Greenhouse, Lever, or Ashby. Every morning Career Desk reads those boards and adds new roles whose title matches your target roles{roles?<> (<strong>{roles}</strong>)</>:null} or the extra keywords below. They arrive as Discovered for you to review. Nothing is applied for.</p>
  <div className="watchlist-add">
   <label>Careers link<input value={link} onChange={e=>setLink(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();add()}}} placeholder="https://jobs.lever.co/company" aria-invalid={!!linkError}/></label>
   <label>Company name <span className="optional">(optional)</span><input value={name} onChange={e=>setName(e.target.value)} placeholder="Shown on added roles" maxLength={200}/></label>
   <button className="secondary" type="button" onClick={add} disabled={!link.trim()}><Plus size={15}/>Add board</button>
  </div>
  {linkError&&<p className="field-error" role="alert">{linkError}</p>}
  {boards.length?<ul className="board-list">{boards.map(b=><li key={boardKey(b)}>
   <div><strong>{b.name}</strong><a href={boardPageUrl(b)} target="_blank" rel="noreferrer">{providerLabels[b.provider]} · {b.slug}</a><small className={b.lastError&&!b.unsaved?'board-error':''}>{b.lastError&&!b.unsaved&&<AlertCircle size={13}/>}{status(b)}</small></div>
   <button className="icon-button" type="button" aria-label={'Stop watching '+b.name} onClick={()=>{setBoards(boards.filter(x=>boardKey(x)!==boardKey(b)));setDirty(true)}}><Trash2 size={15}/></button>
  </li>)}</ul>:<p className="empty-boards">No boards yet. Try a company you’d love to work for.</p>}
  <div className="watchlist-filters">
   <label>Extra title keywords <span className="optional">(comma-separated)</span><input value={keywords} onChange={e=>edit(setKeywords)(e.target.value)} placeholder="e.g. platform engineer, developer advocate" maxLength={2000}/></label>
   <label>Skip titles containing <span className="optional">(comma-separated)</span><input value={exclude} onChange={e=>edit(setExclude)(e.target.value)} placeholder="e.g. intern, principal, contract" maxLength={2000}/></label>
   <label className="check"><input type="checkbox" checked={remoteOnly} onChange={e=>edit(setRemoteOnly)(e.target.checked)}/>Only add roles the board lists as remote</label>
  </div>
  <div className="watchlist-actions">
   <button className="secondary" type="button" disabled={busy||dirty||!boards.length} onClick={check} title={dirty?'Save your changes first':undefined}><RefreshCw size={15}/>Check now</button>
   <button className="primary" type="button" disabled={busy||!dirty} onClick={save}>{busy?'Working…':'Save job boards'}</button>
  </div>
 </section>;
}
