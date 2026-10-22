import {identity,failure} from '@/lib/http';
import {repository} from '@/lib/service';
export async function GET(r:Request){try{const u=await identity(r);return new Response(JSON.stringify(await repository().backup(u.id),null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="career-desk-backup.json"','Cache-Control':'private, no-store'}})}catch(e){return failure(e)}}
