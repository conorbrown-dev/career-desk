// Browser helpers for saving the job source watchlist from the Overview and Search profile.
import {boardKey,watchlistLimits,type Provider} from '@/lib/job-boards';

export type Settings={boards:{provider:Provider;slug:string;name:string}[];keywords:string;exclude:string;places:string;remoteOnly:boolean;feeds:{remotive:boolean}};
export function settingsFrom(w:any):Settings{
 return {boards:(w?.boards||[]).map((b:any)=>({provider:b.provider,slug:b.slug,name:b.name})),keywords:w?.keywords||'',exclude:w?.exclude||'',places:w?.places||'',remoteOnly:!!w?.remoteOnly,feeds:{remotive:!!w?.feeds?.remotive}};
}
/** Adds companies that aren't already watched, up to the board limit; returns how many fit. */
export function withCompanies(s:Settings,companies:{provider:Provider;slug:string;name:string}[]){
 const taken=new Set(s.boards.map(boardKey)),boards=[...s.boards];let added=0;
 for(const c of companies){if(taken.has(boardKey(c)))continue;if(boards.length>=watchlistLimits.boards)break;boards.push({provider:c.provider,slug:c.slug,name:c.name});taken.add(boardKey(c));added++}
 return {settings:{...s,boards},added,full:companies.some(c=>!taken.has(boardKey(c)))};
}
export async function saveWatchlist(s:Settings,skipUnreadable=false):Promise<any>{
 const r=await fetch('/api/discovery',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({...s,skipUnreadable})});
 const d:any=await r.json();if(!r.ok)throw Error(d.error||'Could not save your job sources.');
 return d;
}
export function addedMessage(added:number,skipped:string[]|undefined,full:boolean){
 const parts=[added-(skipped?.length||0)>0?`Watching ${added-(skipped?.length||0)} more ${added-(skipped?.length||0)===1?'company':'companies'}.`:'No new companies added.'];
 if(skipped?.length)parts.push(`Skipped ${skipped.join(', ')}: board unavailable right now.`);
 if(full)parts.push(`You’ve reached the ${watchlistLimits.boards}-board limit.`);
 return parts.join(' ');
}
