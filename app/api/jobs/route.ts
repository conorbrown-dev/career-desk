import {identity,sameOrigin,failure,json} from '@/lib/http';
import {repository} from '@/lib/service';
export async function GET(r:Request){try{const u=await identity(r),repo=repository();const [jobs,profile,runs,usage]=await Promise.all([repo.jobs(u.id),repo.profile(u.id,u.name,u.email),repo.runs(u.id),repo.usage(u.id)]);return json({jobs,profile,runs,usage})}catch(e){return failure(e)}}
export async function POST(r:Request){try{sameOrigin(r);const u=await identity(r);return json(await repository().save(u.id,await r.json()))}catch(e){return failure(e)}}
