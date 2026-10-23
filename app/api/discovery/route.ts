import {HttpError,failure,identity,json,sameOrigin} from '@/lib/http';
import {repository} from '@/lib/service';
import {applySettings,boardKey,emptyWatchlist,publicWatchlist,type Watchlist} from '@/lib/job-boards';
import {readBoard,syncWatchlist} from '@/lib/board-sync';

export const dynamic='force-dynamic';
export const maxDuration=60;
const manualCooldownMs=2*60*1000;

export async function GET(r:Request){try{
 const u=await identity(r),repo=repository();
 return json(publicWatchlist(await repo.watchlist(u.id)||emptyWatchlist(await repo.profile(u.id,u.name,u.email))));
}catch(e){return failure(e)}}

/** Saves watched boards and filters. Newly added boards are read once first, so a bad link is rejected with a reason. */
export async function PUT(r:Request){try{
 sameOrigin(r);const u=await identity(r),repo=repository();
 const text=await r.text();if(text.length>20000)throw new HttpError(413,'Request is too large');
 const input=JSON.parse(text),profile=await repo.profile(u.id,u.name,u.email);
 const {added}=applySettings(await repo.watchlist(u.id)||emptyWatchlist(profile),input);
 if(added.length>5)throw new HttpError(400,'Add up to 5 new boards at a time.');
 const openCounts=new Map<string,number>();
 for(const board of added){try{openCounts.set(boardKey(board),(await readBoard(board)).length)}catch(e){throw new HttpError(400,e instanceof Error?e.message:'That board could not be read.')}}
 const saved=await repo.updateWatchlist(u.id,(current:Watchlist|null)=>{
  const {next}=applySettings(current||emptyWatchlist(profile),input);
  return {...next,boards:next.boards.map(b=>openCounts.has(boardKey(b))&&b.lastOpen===undefined?{...b,lastOpen:openCounts.get(boardKey(b))}:b)};
 });
 return json(publicWatchlist(saved));
}catch(e){return failure(e)}}

/** Check now: reads every watched board and adds new matches as Discovered. */
export async function POST(r:Request){try{
 sameOrigin(r);const u=await identity(r),repo=repository();
 const watch:Watchlist|null=await repo.watchlist(u.id);
 if(!watch?.boards?.length)throw new HttpError(400,'Add a company job board first.');
 if(watch.lastSyncAt&&Date.now()-Date.parse(watch.lastSyncAt)<manualCooldownMs)throw new HttpError(429,'Job boards were checked a moment ago. Try again in a couple of minutes.');
 const result=await syncWatchlist(repo,u.id,'manual');
 return json({result,watchlist:publicWatchlist(await repo.watchlist(u.id))});
}catch(e){return failure(e)}}
