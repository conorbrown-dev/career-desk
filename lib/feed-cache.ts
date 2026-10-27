// One shared copy of each broad job feed for every workspace. Remotive asks API users to fetch at most four times
// a day, so a refresh slot is claimed atomically at most once every six hours no matter how many checks run.
import type {Database} from './repository';
import {normalizeRemotive,type Posting} from './job-boards';
import {fetchPublic} from './import-opportunity';

export const feedCacheSql="CREATE TABLE IF NOT EXISTS career_feed_cache(feed TEXT PRIMARY KEY,payload JSONB NOT NULL DEFAULT '[]'::jsonb,fetched_at TIMESTAMPTZ,attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),last_error TEXT)";
export const remotiveApi='https://remotive.com/api/remote-jobs';
const refreshAfterHours=12,attemptEveryHours=6,maxPostings=5000;

export type FetchJson=(url:string)=>Promise<any>;
/** Full Remotive feed in one request; it can be several megabytes because each job carries its description. */
export const fetchRemotiveJson:FetchJson=async url=>JSON.parse((await fetchPublic(url,25000,40*1024*1024)).html);

/** Returns cached Remotive postings, refreshing them first when they are stale and a refresh slot is free. */
export async function remotivePostings(db:Database,fetchJson:FetchJson=fetchRemotiveJson):Promise<{postings:Posting[];fetchedAt:string|null;error?:string}>{
 const read=async()=>(await db.query('SELECT payload,fetched_at,last_error FROM career_feed_cache WHERE feed=$1',['remotive'])).rows[0];
 let row=await read();
 const stale=!row?.fetched_at||Date.now()-new Date(row.fetched_at).getTime()>refreshAfterHours*3600000;
 if(stale){
  const claimed=(await db.query(`INSERT INTO career_feed_cache(feed,attempted_at) VALUES($1,NOW()) ON CONFLICT(feed) DO UPDATE SET attempted_at=NOW()
   WHERE career_feed_cache.attempted_at<NOW()-INTERVAL '${attemptEveryHours} hours' RETURNING feed`,['remotive'])).rows.length>0;
  if(claimed){
   try{
    const postings=normalizeRemotive(await fetchJson(remotiveApi)).slice(0,maxPostings);
    if(!postings.length)throw Error('Remotive returned no jobs.');
    await db.query('UPDATE career_feed_cache SET payload=$2,fetched_at=NOW(),last_error=NULL WHERE feed=$1',['remotive',JSON.stringify(postings)]);
   }catch(e){
    await db.query('UPDATE career_feed_cache SET last_error=$2 WHERE feed=$1',['remotive',(e instanceof Error?e.message:String(e)).slice(0,500)]);
   }
   row=await read();
  }
 }
 const postings:Posting[]=Array.isArray(row?.payload)?row.payload:[];
 const fetchedAt=row?.fetched_at?new Date(row.fetched_at).toISOString():null;
 if(!postings.length)return {postings,fetchedAt,error:row?.last_error?'Remotive is unavailable right now; it will be tried again later.':'Remotive jobs will be available after the next refresh.'};
 return {postings,fetchedAt};
}
