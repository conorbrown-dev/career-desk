'use client';
import {useState} from 'react';
import {Sparkles,Building2,RefreshCw,Copy,ExternalLink,Plus,Rss} from 'lucide-react';
import {suggestCompanies} from '@/lib/company-catalog';
import {addedMessage,saveWatchlist,settingsFrom,withCompanies} from './watchlist-client';

export const discoveryRequest='Use Career Desk to find new job openings for me. First read my profile, search criteria, and current applications. Then search employer career sites and job boards for current postings that fit my target roles, location or remote eligibility, and minimum base. Confirm each posting is still open on the employer’s site. Save each new match to Career Desk as Discovered with its posting link, and skip anything already in my pipeline. Finish by recording the discovery run with the sources you checked, how many you added, and any limitations. Do not apply to anything.';
const claudeUrl='https://claude.ai/new?q='+encodeURIComponent(discoveryRequest);
const chatgptUrl='https://chatgpt.com/?q='+encodeURIComponent(discoveryRequest);
const staleAfterDays=3;

export async function checkBoards(notify:(m:string)=>void,reload:()=>Promise<void>){
 const r=await fetch('/api/discovery',{method:'POST'});const d:any=await r.json();
 if(!r.ok)throw Error(d.error||'The job source check failed.');
 await reload();
 const {added,errors}=d.result;
 notify(added?`${added} new ${added===1?'opportunity':'opportunities'} added as Discovered.`:errors?.length?'Check finished with problems. See Discovery activity.':'No new matches in your job sources.');
}

export default function DiscoveryPanel({data,demo,notify,reload,openBoards}:{data:any;demo:boolean;notify:(m:string)=>void;reload:()=>Promise<void>;openBoards:()=>void}){
 const [busy,setBusy]=useState(false);
 const watch=data?.watchlist,boards:any[]=watch?.boards||[],remotive=!!watch?.feeds?.remotive,assistants=Number(data?.assistants||0);
 const watching=boards.length>0||remotive;
 const suggested=boards.length?[]:suggestCompanies(data?.profile,boards,8);
 const last=data?.runs?.[0]?.at,days=last?Math.floor((Date.now()-Date.parse(last))/86400000):null;
 async function copy(){try{await navigator.clipboard.writeText(discoveryRequest);notify('Discovery request copied. Paste it into Claude or ChatGPT.')}catch{notify('Ask your assistant to find new openings using Career Desk.')}}
 async function run(work:()=>Promise<void>){if(demo){notify('Job sources are available in a connected account.');return}setBusy(true);try{await work()}catch(e){notify(e instanceof Error?e.message:String(e))}finally{setBusy(false)}}
 const check=()=>run(()=>checkBoards(notify,reload));
 const addSuggested=()=>run(async()=>{const {settings,added,full}=withCompanies(settingsFrom(watch),suggested);const d=await saveWatchlist(settings,true);await reload();notify(addedMessage(added,d.skipped,full)+' They’ll be checked every morning, or press Check now.')});
 const enableRemotive=()=>run(async()=>{await saveWatchlist({...settingsFrom(watch),feeds:{remotive:true}});await reload();notify('Remotive feed on. Matching remote roles arrive with the next check.')});
 const summary=[boards.length?`${boards.length} compan${boards.length===1?'y':'ies'} (${boards.slice(0,4).map(b=>b.name).join(', ')}${boards.length>4?', …':''})`:'',remotive?'the Remotive remote-jobs feed':''].filter(Boolean).join(' and ');
 return <section className="panel discovery" aria-labelledby="discovery-heading">
  <div className="section-top"><div><span className="eyebrow">FIND NEW OPPORTUNITIES</span><h2 id="discovery-heading">Keep your pipeline fresh.</h2></div>
   {(days===null||days>=staleAfterDays)&&<span className="pill orange">{days===null?'No searches recorded yet':`Last search ${days} days ago`}</span>}</div>
  <div className="discovery-grid">
   <div className="discovery-option">
    <div className="discovery-title"><Sparkles size={18}/><strong>Search with your assistant</strong></div>
    <p className="muted">{assistants?'Opens a new chat with the search request filled in. Press send, and your assistant reads your criteria, searches current postings, and saves matches here as Discovered. It never applies for you.':'Connect Claude or ChatGPT so it can read your criteria and save matches here. You can also copy the request into any assistant.'}</p>
    <div className="discovery-actions">
     {assistants>0?<><a className="primary" href={claudeUrl} target="_blank" rel="noreferrer">Open in Claude <ExternalLink size={15}/></a><a className="secondary" href={chatgptUrl} target="_blank" rel="noreferrer">Open in ChatGPT <ExternalLink size={15}/></a></>:!demo&&<a className="primary" href="/connect">Connect an assistant</a>}
     <button className="text-button" onClick={copy}><Copy size={15}/>Copy request</button>
    </div>
   </div>
   <div className="discovery-option">
    <div className="discovery-title"><Building2 size={18}/><strong>Automatic job sources</strong></div>
    <p className="muted">{watching?`Watching ${summary}. Checked every morning; roles matching your target roles arrive as Discovered.`:'Pick companies and feeds once; every morning Career Desk adds new roles that match your target roles as Discovered.'}</p>
    {suggested.length>0&&<p className="suggest-preview"><strong>Suggested for your roles:</strong> {suggested.map(c=>c.name).join(', ')}</p>}
    {watch?.lastSyncAt&&<small className="discovery-meta">Last checked {new Date(watch.lastSyncAt).toLocaleString()}</small>}
    <div className="discovery-actions">
     {suggested.length>0&&<button className="primary" disabled={busy} onClick={addSuggested}><Plus size={15}/>{busy?'Adding…':`Add ${suggested.length} suggested companies`}</button>}
     {!remotive&&<button className="secondary" disabled={busy} onClick={enableRemotive}><Rss size={15}/>Turn on Remotive feed</button>}
     {watching&&<button className={suggested.length?'secondary':'primary'} disabled={busy} onClick={check}><RefreshCw size={15}/>{busy?'Checking…':'Check now'}</button>}
     <button className="text-button" onClick={openBoards}>{watching?'Manage sources':'Browse companies'}</button>
    </div>
   </div>
  </div>
 </section>;
}
