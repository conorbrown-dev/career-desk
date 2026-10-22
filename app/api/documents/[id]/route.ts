import {identity,failure} from '@/lib/http';
import {repository} from '@/lib/service';
export async function GET(r:Request,{params}:{params:Promise<{id:string}>}){try{const u=await identity(r);const {id}=await params;const d=await repository().document(u.id,id);if(!d)return new Response('Document not found',{status:404});return new Response(new Uint8Array(d.bytes),{headers:{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename="'+d.name.replace(/[^a-zA-Z0-9._-]/g,'-')+'"','Cache-Control':'private, no-store'}})}catch(e){return failure(e)}}
