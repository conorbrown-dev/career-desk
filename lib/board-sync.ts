// Reads watched company job boards and adds new matching postings to the pipeline as Discovered.
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import type {Repository} from './repository';
import {canonicalUrl} from './config';
import {HttpError} from './http';
import {fetchPublic} from './import-opportunity';
import {type Board,type Posting,type Watchlist,boardApiUrl,boardKey,boardPageUrl,matchPosting,normalizeBoard,providerLabels,watchlistLimits} from './job-boards';

export type FetchJson=(url:string)=>Promise<any>;
/** Public board APIs only, through the importer's SSRF-safe fetch; large boards carry descriptions, hence the higher size cap. */
export const fetchBoardJson:FetchJson=async url=>{const r=await fetchPublic(url,15000,8*1024*1024);return JSON.parse(r.html)};

const message=(e:unknown)=>e instanceof Error?e.message:String(e);
export async function readBoard(board:Pick<Board,'provider'|'slug'|'name'>,fetchJson:FetchJson=fetchBoardJson):Promise<Posting[]>{
 let data:any;
 try{data=await fetchJson(boardApiUrl(board))}catch{throw Error(`Couldn’t read the ${providerLabels[board.provider]} board “${board.slug}”. Check the link; the company may have moved to a different careers site.`)}
 const shaped=board.provider==='lever'?Array.isArray(data):Array.isArray(data?.jobs);
 if(!shaped)throw Error(`The ${providerLabels[board.provider]} board “${board.slug}” didn’t return a job list.`);
 return normalizeBoard(board.provider,data,board.name);
}

export function discoveredJob(p:Posting,board:Board,role:string,at:Date){
 return {company:p.company||board.name,title:p.title,stage:'Discovered',url:p.url,location:p.location||'Not listed',remote:p.remote?'Remote (listed on posting)':'Needs verification',degree:'Needs verification',minBase:null,maxBase:null,fit:'Needs review',match:`Title matches your target “${role}”.`,gaps:'',nextAction:'Review the posting against your criteria, then prepare it or remove it.',notes:'',description:'',source:`${providerLabels[board.provider]} job board · ${board.name}`,verifiedAt:at.toISOString()};
}

export type SyncResult={checked:number;open:number;matched:number;added:number;errors:string[];summary:string};
/** Checks every watched board once. Postings already seen, already in the pipeline, or not matching are skipped;
 *  matches beyond the per-run budget stay unseen so the next check picks them up. */
export async function syncWatchlist(repo:Repository,owner:string,source:'manual'|'scheduled',fetchJson:FetchJson=fetchBoardJson,now=()=>new Date()):Promise<SyncResult>{
 const watch:Watchlist|null=await repo.watchlist(owner);
 if(!watch?.boards?.length)return {checked:0,open:0,matched:0,added:0,errors:[],summary:'No company job boards are being watched yet.'};
 const profile=await repo.profile(owner);
 const criteria={roles:String(profile?.criteria?.roles||''),keywords:watch.keywords||'',exclude:watch.exclude||'',remoteOnly:!!watch.remoteOnly};
 const inPipeline=new Set<string>((await repo.jobs(owner)).map((j:any)=>j.url).filter(Boolean));
 const updates=new Map<string,{status:Partial<Board>;seen:string[]|null}>();
 const errors:string[]=[],added:string[]=[];
 let open=0,matched=0,budget=watchlistLimits.addsPerRun,full=false,waiting=false;
 for(const board of watch.boards){
  const key=boardKey(board),checkedAt=now().toISOString();
  let postings:Posting[];
  try{postings=await readBoard(board,fetchJson)}catch(e){errors.push(message(e));updates.set(key,{status:{lastCheckedAt:checkedAt,lastError:message(e)},seen:null});continue}
  open+=postings.length;
  const seen=new Set(watch.seen?.[key]||[]),nextSeen:string[]=[];
  let boardMatched=0,boardAdded=0;
  for(const p of postings){
   if(seen.has(p.id)){nextSeen.push(p.id);continue}
   const role=matchPosting(p,criteria);
   let url='';try{url=canonicalUrl(p.url)}catch{/* unusable link: treated as not matching */}
   if(!role||!url||inPipeline.has(url)){nextSeen.push(p.id);continue}
   boardMatched++;
   if(full||budget<=0||boardAdded>=watchlistLimits.addsPerBoard){waiting=true;continue}
   try{
    await repo.save(owner,discoveredJob(p,board,role,now()),true);
    inPipeline.add(url);boardAdded++;budget--;added.push(`${p.title} (${p.company||board.name})`);nextSeen.push(p.id);
   }catch(e){
    const m=message(e);
    if(/deleted/i.test(m))throw e;
    if(/limit reached/i.test(m)){full=true;waiting=true;errors.push(m);continue}
    if(!/already in your pipeline/i.test(m))errors.push(`${board.name}: ${p.title}: ${m}`);
    nextSeen.push(p.id);
   }
  }
  matched+=boardMatched;
  updates.set(key,{status:{lastCheckedAt:checkedAt,lastOpen:postings.length,lastMatched:boardMatched,lastAdded:boardAdded,lastError:undefined},seen:nextSeen.slice(-watchlistLimits.seenPerBoard)});
 }
 const n=watch.boards.length,names=watch.boards.map(b=>b.name).join(', ');
 const parts=[`Checked ${n} company job board${n===1?'':'s'} (${names}): ${open} open role${open===1?'':'s'}, ${matched} new match${matched===1?'':'es'}, ${added.length} added as Discovered.`];
 if(added.length)parts.push('Added: '+added.slice(0,10).join('; ')+(added.length>10?`; and ${added.length-10} more.`:'.'));
 if(waiting)parts.push('More matches are waiting and will be added on the next check.');
 if(errors.length)parts.push('Problems: '+[...new Set(errors)].slice(0,5).join(' '));
 if(!criteria.roles.trim()&&!criteria.keywords.trim())parts.push('Add target roles to your search profile so postings can be matched.');
 const summary=parts.join(' ').slice(0,5000),at=now().toISOString();
 await repo.updateWatchlist(owner,(current:Watchlist|null)=>{
  if(!current)return null;
  const seenNext={...(current.seen||{})};
  const boards=current.boards.map(b=>{const u=updates.get(boardKey(b));if(!u)return b;if(u.seen)seenNext[boardKey(b)]=u.seen;return {...b,...u.status}});
  return {...current,boards,seen:seenNext,lastSyncAt:at,lastSyncSource:source,lastSyncSummary:summary};
 });
 await repo.recordRun(owner,{id:randomUUID(),at,summary,sources:watch.boards.slice(0,50).map(boardPageUrl),added:added.length,status:source==='manual'?'Job board check':'Scheduled job board check'});
 return {checked:n,open,matched,added:added.length,errors,summary};
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; without a configured secret the endpoint stays closed. */
export function authorizeCron(header:string|null,secret:string|undefined){
 if(!secret||secret.length<32)throw new HttpError(503,'Scheduled checks are not configured');
 const supplied=header?.startsWith('Bearer ')?header.slice(7):'';
 const digest=(v:string)=>createHash('sha256').update(v).digest();
 if(!supplied||!timingSafeEqual(digest(supplied),digest(secret)))throw new HttpError(401,'Invalid scheduler credential');
}
