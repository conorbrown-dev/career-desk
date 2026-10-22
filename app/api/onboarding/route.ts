import {identity,sameOrigin,failure,json} from '@/lib/http';
import {repository} from '@/lib/service';
export async function POST(r:Request){try{sameOrigin(r);const u=await identity(r);return json(await repository().saveGettingStarted(u.id,await r.json(),u.name,u.email))}catch(e){return failure(e)}}
