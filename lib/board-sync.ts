// Reads the watched sources (company job boards and opt-in feeds) and adds new matching postings to the pipeline as Discovered.
import {createHash,randomUUID,timingSafeEqual} from 'node:crypto';
import type {Repository} from './repository';
import {canonicalUrl} from './config';
import {HttpError} from './http';
import {fetchPublic} from './import-opportunity';
import {getPool} from './db';
import {remotivePostings} from './feed-cache';
import {type Board,type Feed,type Posting,type SourceStatus,type Watchlist,boardApiUrl,boardKey,boardPageUrl,feedKey,hasSources,matchPosting,normalizeBoard,providerLabels,remoteRegionAllowed,watchlistLimits} from './job-boards';

export type FetchJson=(url:string)=>Promise<any>;
/** Public board APIs only, through the importer's SSRF-safe fetch; large boards carry descriptions, hence the higher size cap. */
export const fetchBoardJson:FetchJson=async url=>{const r=await fetchPublic(url,15000,8*1024*1024);return JSON.parse(r.html)};
export type FeedLoader=()=>Promise<{postings:Posting[];error?:string}>;
export type SyncDeps={fetchJson?:FetchJson;remotive?:FeedLoader;now?:()=>Date};

const message=(e:unknown)=>e instanceof Error?e.message:String(e);
export async function readBoard(board:Pick<Board,'provider'|'slug'|'name'>,fetchJson:FetchJson=fetchBoardJson):Promise<Posting[]>{
 let data:any;
 try{data=await fetchJson(boardApiUrl(board))}catch{throw Error(`Couldn’t read the ${providerLabels[board.provider]} board “${board.slug}”. Check the link; the company may have moved to a different careers site.`)}
 const shaped=board.provider==='lever'?Array.isArray(data):Array.isArray(data?.jobs);
 if(!shaped)throw Error(`The ${providerLabels[board.provider]} board “${board.slug}” didn’t return a job list.`);
 return normalizeBoard(board.provider,data,board.name);
}

const common={degree:'Needs verification',minBase:null,maxBase:null,fit:'Needs review',gaps:'',nextAction:'Review the posting against your criteria, then prepare it or remove it.',description:''};
export function discoveredJob(p:Posting,board:Pick<Board,'provider'|'name'>,role:string,at:Date){
 return {...common,company:p.company||board.name,title:p.title,stage:'Discovered',url:p.url,location:p.location||'Not listed',remote:p.remote?'Remote (listed on posting)':'Needs verification',match:`Title matches your target “${role}”.`,notes:'',source:`${providerLabels[board.provider]} job board · ${board.name}`,verifiedAt:at.toISOString()};
}
/** Remotive asks that its jobs link back to Remotive and credit it as the source; the posting URL is Remotive's own. */
export function remotiveJob(p:Posting,role:string,at:Date){
 const region=p.location||'not stated';
 return {...common,company:p.company,title:p.title,stage:'Discovered',url:p.url,location:'Remote · '+region,remote:`Remote; applicant location: ${region}. Verify eligibility.`,match:`Title matches your target “${role}”.`,notes:['Found via Remotive (remotive.com). The posting link opens the job on Remotive.',p.salary?'Listed salary: '+p.salary:''].filter(Boolean).join('\n'),source:'Remotive · remote job feed',verifiedAt:at.toISOString()};
}

type Source={key:string;name:string;pageUrl:string;feed?:Feed;read:()=>Promise<Posting[]>;eligible:(p:Posting)=>boolean;job:(p:Posting,role:string,at:Date)=>any};

export type SyncResult={checked:number;open:number;matched:number;added:number;errors:string[];summary:string};
/** Checks every watched source once. Postings already seen, already in the pipeline, or not matching are skipped;
 *  matches beyond the per-run budget stay unseen so the next check picks them up. */
export async function syncWatchlist(repo:Repository,owner:string,trigger:'manual'|'scheduled',deps:SyncDeps={}):Promise<SyncResult>{
 const fetchJson=deps.fetchJson||fetchBoardJson,now=deps.now||(()=>new Date());
 const loadRemotive=deps.remotive||(()=>remotivePostings(getPool()));
 const watch:Watchlist|null=await repo.watchlist(owner);
 if(!hasSources(watch))return {checked:0,open:0,matched:0,added:0,errors:[],summary:'No job sources are being watched yet.'};
 const profile=await repo.profile(owner),profileRemote=String(profile?.criteria?.remote||'');
 const criteria={roles:String(profile?.criteria?.roles||''),keywords:watch!.keywords||'',exclude:watch!.exclude||'',places:watch!.places||'',remoteOnly:!!watch!.remoteOnly};
 const sources:Source[]=watch!.boards.map(b=>({key:boardKey(b),name:b.name,pageUrl:boardPageUrl(b),read:()=>readBoard(b,fetchJson),eligible:()=>true,job:(p:Posting,role:string,at:Date)=>discoveredJob(p,b,role,at)}));
 if(watch!.feeds?.remotive)sources.push({key:feedKey('remotive'),name:'Remotive',pageUrl:'https://remotive.com',feed:'remotive',
  read:async()=>{const r=await loadRemotive();if(r.error&&!r.postings.length)throw Error(r.error);return r.postings},
  eligible:p=>remoteRegionAllowed(p.location,profileRemote),job:remotiveJob});
 const inPipeline=new Set<string>((await repo.jobs(owner)).map((j:any)=>j.url).filter(Boolean));
 const updates=new Map<string,{status:SourceStatus;seen:string[]|null}>();
 const errors:string[]=[],added:string[]=[];
 let open=0,matched=0,budget=watchlistLimits.addsPerRun,full=false,waiting=false;
 for(const source of sources){
  const checkedAt=now().toISOString();
  let postings:Posting[];
  try{postings=await source.read()}catch(e){errors.push(message(e));updates.set(source.key,{status:{lastCheckedAt:checkedAt,lastError:message(e)},seen:null});continue}
  open+=postings.length;
  const seen=new Set(watch!.seen?.[source.key]||[]),nextSeen:string[]=[];
  let sourceMatched=0,sourceAdded=0;
  for(const p of postings){
   if(seen.has(p.id)){nextSeen.push(p.id);continue}
   const role=source.eligible(p)?matchPosting(p,criteria):null;
   let url='';try{url=canonicalUrl(p.url)}catch{/* unusable link: treated as not matching */}
   if(!role||!url||inPipeline.has(url)){nextSeen.push(p.id);continue}
   sourceMatched++;
   if(full||budget<=0||sourceAdded>=watchlistLimits.addsPerBoard){waiting=true;continue}
   try{
    await repo.save(owner,source.job(p,role,now()),true);
    inPipeline.add(url);sourceAdded++;budget--;added.push(`${p.title} (${p.company||source.name})`);nextSeen.push(p.id);
   }catch(e){
    const m=message(e);
    if(/deleted/i.test(m))throw e;
    if(/limit reached/i.test(m)){full=true;waiting=true;errors.push(m);continue}
    if(!/already in your pipeline/i.test(m))errors.push(`${source.name}: ${p.title}: ${m}`);
    nextSeen.push(p.id);
   }
  }
  matched+=sourceMatched;
  updates.set(source.key,{status:{lastCheckedAt:checkedAt,lastOpen:postings.length,lastMatched:sourceMatched,lastAdded:sourceAdded,lastError:undefined},seen:nextSeen.slice(-watchlistLimits.seenPerBoard*2)});
 }
 const n=sources.length,names=sources.map(s=>s.name).join(', ');
 const parts=[`Checked ${n} job source${n===1?'':'s'} (${names}): ${open} open role${open===1?'':'s'}, ${matched} new match${matched===1?'':'es'}, ${added.length} added as Discovered.`];
 if(added.length)parts.push('Added: '+added.slice(0,10).join('; ')+(added.length>10?`; and ${added.length-10} more.`:'.'));
 if(waiting)parts.push('More matches are waiting and will be added on the next check.');
 if(errors.length)parts.push('Problems: '+[...new Set(errors)].slice(0,5).join(' '));
 if(!criteria.roles.trim()&&!criteria.keywords.trim())parts.push('Add target roles to your search profile so postings can be matched.');
 const summary=parts.join(' ').slice(0,5000),at=now().toISOString();
 await repo.updateWatchlist(owner,(current:Watchlist|null)=>{
  if(!current)return null;
  const seenNext={...(current.seen||{})};
  for(const [key,u] of updates)if(u.seen)seenNext[key]=u.seen;
  const boards=current.boards.map(b=>{const u=updates.get(boardKey(b));return u?{...b,...u.status}:b});
  const feedStatus={...(current.feedStatus||{})};
  for(const s of sources)if(s.feed&&updates.has(s.key))feedStatus[s.feed]=updates.get(s.key)!.status;
  return {...current,boards,feedStatus,seen:seenNext,lastSyncAt:at,lastSyncSource:trigger,lastSyncSummary:summary};
 });
 await repo.recordRun(owner,{id:randomUUID(),at,summary,sources:sources.slice(0,50).map(s=>s.pageUrl),added:added.length,status:trigger==='manual'?'Job source check':'Scheduled job source check'});
 return {checked:n,open,matched,added:added.length,errors,summary};
}

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; without a configured secret the endpoint stays closed. */
export function authorizeCron(header:string|null,secret:string|undefined){
 if(!secret||secret.length<32)throw new HttpError(503,'Scheduled checks are not configured');
 const supplied=header?.startsWith('Bearer ')?header.slice(7):'';
 const digest=(v:string)=>createHash('sha256').update(v).digest();
 if(!supplied||!timingSafeEqual(digest(supplied),digest(secret)))throw new HttpError(401,'Invalid scheduler credential');
}
