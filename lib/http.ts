import {getAuth} from './auth';
import {configured} from './config';
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export async function identity(request:Request){if(!configured())throw new HttpError(503,'Account setup is not complete');const session=await getAuth().api.getSession({headers:request.headers});if(!session)throw new HttpError(401,'Sign in to open your workspace');return session.user;}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(!origin||new URL(request.url).origin!==origin)throw new HttpError(403,'A same-origin request is required');}
export function failure(e:unknown){const status=e instanceof HttpError?e.status:400;return Response.json({error:e instanceof Error?e.message:'Request failed'},{status,headers:{'Cache-Control':'no-store'}})}
export function json(data:unknown){return Response.json(data,{headers:{'Cache-Control':'private, no-store'}})}
