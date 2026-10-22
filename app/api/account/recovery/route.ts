import {getAuth} from '@/lib/auth';
import {HttpError,failure,json,sameOrigin} from '@/lib/http';
import {recoveryGrant} from '@/lib/recovery';
import {z} from 'zod';
export async function POST(r:Request){try{
 sameOrigin(r);
 const auth=getAuth();const session=await auth.api.getSession({headers:r.headers,query:{disableCookieCache:true}});
 if(!session)throw new HttpError(401,'The signed-in recovery session has expired.');
 const token=recoveryGrant(session.user.email);
 const text=await r.text();if(text.length>2000)throw new HttpError(413,'Request is too large');
 const {newPassword}=z.object({newPassword:z.string().min(12).max(128)}).parse(JSON.parse(text));
 await auth.api.resetPassword({body:{newPassword,token}});
 return json({status:true});
}catch(e){return failure(e)}}
