import {getAuth} from './auth';
import {configured} from './config';
import {after} from 'next/server';
import {reportError,shouldReport} from './error-report';
export class HttpError extends Error{constructor(public status:number,message:string){super(message)}}
export async function identity(request:Request){if(!configured())throw new HttpError(503,'Account setup is not complete');const session=await getAuth().api.getSession({headers:request.headers});if(!session)throw new HttpError(401,'Sign in to open your workspace');return session.user;}
export function sameOrigin(request:Request){const origin=request.headers.get('origin');if(!origin||new URL(request.url).origin!==origin)throw new HttpError(403,'A same-origin request is required');}
export function failure(e:unknown,route?:string){
 // Crashes and infrastructure faults are reported and shown generically; expected validation messages pass through.
 if(!(e instanceof HttpError)&&shouldReport(e)){const send=()=>reportError(e,{route,source:'api'});try{after(send)}catch{void send()}return Response.json({error:'Something went wrong. Try again in a moment.'},{status:500,headers:{'Cache-Control':'no-store'}})}
 const status=e instanceof HttpError?e.status:400;return Response.json({error:e instanceof Error?e.message:'Request failed'},{status,headers:{'Cache-Control':'no-store'}})}
export function json(data:unknown){return Response.json(data,{headers:{'Cache-Control':'private, no-store'}})}
