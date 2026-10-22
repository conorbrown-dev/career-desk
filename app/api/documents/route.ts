import {identity,sameOrigin,failure,json} from '@/lib/http';
import {repository} from '@/lib/service';
export async function POST(r:Request){try{sameOrigin(r);const u=await identity(r);if(Number(r.headers.get('content-length')||0)>2500000)throw Error('PDF must be 2 MB or smaller');const f=await r.formData(),file=f.get('file') as File;if(!file||typeof file.arrayBuffer!=='function')throw Error('Choose a PDF');return json(await repository().saveDocument(u.id,String(f.get('jobId')),file.name,String(f.get('kind')),Buffer.from(await file.arrayBuffer())))}catch(e){return failure(e)}}
