import {failure,json} from '@/lib/http';
import {getPool} from '@/lib/db';
import {repository} from '@/lib/service';
import {authorizeCron,syncWatchlist} from '@/lib/board-sync';

export const dynamic='force-dynamic';
export const maxDuration=60;
const budgetMs=45000;

/** Daily Vercel Cron: checks each workspace's watched job boards, oldest check first.
 *  Workspaces checked by hand in the last 20 hours are skipped; any left when time runs out go first tomorrow. */
export async function GET(r:Request){try{
 authorizeCron(r.headers.get('authorization'),process.env.CRON_SECRET);
 const started=Date.now(),repo=repository();
 const owners=(await getPool().query(`SELECT w.owner_id FROM career_watchlists w JOIN "user" u ON u.id=w.owner_id
  WHERE (jsonb_array_length(COALESCE(w.payload->'boards','[]'::jsonb))>0 OR w.payload->'feeds'->>'remotive'='true')
  AND (w.payload->>'lastSyncAt' IS NULL OR (w.payload->>'lastSyncAt')::timestamptz<NOW()-INTERVAL '20 hours')
  ORDER BY w.payload->>'lastSyncAt' NULLS FIRST LIMIT 500`)).rows.map((row:any)=>row.owner_id as string);
 let checked=0,added=0,failed=0,deferred=0;
 for(const owner of owners){
  if(Date.now()-started>budgetMs){deferred++;continue}
  try{added+=(await syncWatchlist(repo,owner,'scheduled')).added;checked++}
  catch(e){failed++;console.error('Scheduled job board check failed:',e instanceof Error?e.message:e)}
 }
 return json({workspaces:owners.length,checked,added,failed,deferred});
}catch(e){return failure(e)}}
