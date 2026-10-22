import {identity,sameOrigin,failure,json} from '@/lib/http';
import {repository} from '@/lib/service';
export async function POST(r:Request){try{sameOrigin(r);const u=await identity(r);return json(await repository().saveProfile(u.id,await r.json()))}catch(e){return failure(e)}}
