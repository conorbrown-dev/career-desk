import {identity,sameOrigin,failure,json} from '@/lib/http';
import {repository} from '@/lib/service';
import {getAuth} from '@/lib/auth';
import {emptyWatchlist,publicWatchlist} from '@/lib/job-boards';
// Count of assistants (Claude, ChatGPT) the user has authorized through OAuth; only decides which discovery actions to show.
const connectedAssistants=(r:Request)=>getAuth().api.getOAuthConsents({headers:r.headers}).then(grants=>Array.isArray(grants)?grants.length:0,()=>0);
export async function GET(r:Request){try{const u=await identity(r),repo=repository();const [jobs,profile,runs,usage,watchlist,assistants]=await Promise.all([repo.jobs(u.id),repo.profile(u.id,u.name,u.email),repo.runs(u.id),repo.usage(u.id),repo.watchlist(u.id),connectedAssistants(r)]);return json({jobs,profile,runs,usage,watchlist:publicWatchlist(watchlist||emptyWatchlist(profile)),assistants})}catch(e){return failure(e)}}
export async function POST(r:Request){try{sameOrigin(r);const u=await identity(r);return json(await repository().save(u.id,await r.json()))}catch(e){return failure(e)}}
