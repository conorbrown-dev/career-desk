import {getAuth} from '@/lib/auth';
import {HttpError,failure,json,sameOrigin} from '@/lib/http';
import {z} from 'zod';
export async function DELETE(r:Request){try{
 sameOrigin(r);const auth=getAuth();const session=await auth.api.getSession({headers:r.headers,query:{disableCookieCache:true}});if(!session)throw new HttpError(401,'Sign in required');
 const text=await r.text();if(text.length>1000)throw new HttpError(413,'Request too large');const {id}=z.object({id:z.string().min(1).max(200)}).parse(JSON.parse(text));
 const grants=await auth.api.getOAuthConsents({headers:r.headers});if(!grants.some(g=>g.id===id))throw new HttpError(404,'Connection not found');
 await auth.api.deleteOAuthConsent({headers:r.headers,body:{id}});return json({disconnected:true});
}catch(e){return failure(e)}}
