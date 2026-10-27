import {HttpError,failure,identity,json,sameOrigin} from '@/lib/http';
import {repository} from '@/lib/service';
import {applySettings,boardKey,emptyWatchlist,hasSources,publicWatchlist,watchlistLimits,type Watchlist} from '@/lib/job-boards';
import {readBoard,syncWatchlist} from '@/lib/board-sync';

export const dynamic='force-dynamic';
export const maxDuration=60;
const manualCooldownMs=2*60*1000;

export async function GET(r:Request){try{
 const u=await identity(r),repo=repository();
 return json(publicWatchlist(await repo.watchlist(u.id)||emptyWatchlist(await repo.profile(u.id,u.name,u.email))));
}catch(e){return failure(e)}}

/** Saves watched sources and filters. Newly added boards are read once first: a typed link that fails is rejected with
 *  a reason; with `skipUnreadable` (one-click catalog adds) unreadable boards are left out and reported instead. */
export async function PUT(r:Request){try{
 sameOrigin(r);const u=await identity(r),repo=repository();
 const text=await r.text();if(text.length>40000)throw new HttpError(413,'Request is too large');
 const {skipUnreadable,...input}=JSON.parse(text),profile=await repo.profile(u.id,u.name,u.email);
 const {added}=applySettings(await repo.watchlist(u.id)||emptyWatchlist(profile),input);
 if(added.length>watchlistLimits.newBoardsPerSave)throw new HttpError(400,`Add up to ${watchlistLimits.newBoardsPerSave} new boards at a time.`);
 const reads=await Promise.allSettled(added.map(board=>readBoard(board)));
 const openCounts=new Map<string,number>(),unreadable=new Set<string>(),skipped:string[]=[];
 reads.forEach((result,i)=>{
  const board=added[i];
  if(result.status==='fulfilled'){openCounts.set(boardKey(board),result.value.length);return}
  if(!skipUnreadable)throw new HttpError(400,result.reason instanceof Error?result.reason.message:'That board could not be read.');
  unreadable.add(boardKey(board));skipped.push(board.name);
 });
 const accepted={...input,boards:(input.boards||[]).filter((b:any)=>!unreadable.has(boardKey(b)))};
 const saved=await repo.updateWatchlist(u.id,(current:Watchlist|null)=>{
  const {next}=applySettings(current||emptyWatchlist(profile),accepted);
  return {...next,boards:next.boards.map(b=>openCounts.has(boardKey(b))&&b.lastOpen===undefined?{...b,lastOpen:openCounts.get(boardKey(b))}:b)};
 });
 return json({...(publicWatchlist(saved)||{}),skipped});
}catch(e){return failure(e)}}

/** Check now: reads every watched source and adds new matches as Discovered. */
export async function POST(r:Request){try{
 sameOrigin(r);const u=await identity(r),repo=repository();
 const watch:Watchlist|null=await repo.watchlist(u.id);
 if(!hasSources(watch))throw new HttpError(400,'Add a company job board or turn on a job feed first.');
 if(watch!.lastSyncAt&&Date.now()-Date.parse(watch!.lastSyncAt)<manualCooldownMs)throw new HttpError(429,'Your job sources were checked a moment ago. Try again in a couple of minutes.');
 const result=await syncWatchlist(repo,u.id,'manual');
 return json({result,watchlist:publicWatchlist(await repo.watchlist(u.id))});
}catch(e){return failure(e)}}
