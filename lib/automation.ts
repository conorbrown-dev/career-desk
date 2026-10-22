import {createHash,timingSafeEqual} from 'node:crypto';
import {HttpError} from './http';

export function authorizeAutomation(header:string|null,secret:string|undefined){
  if(!secret||secret.length<40)throw new HttpError(503,'Automation connection is not configured');
  const supplied=header?.startsWith('Bearer ')?header.slice(7):'';
  const digest=(value:string)=>createHash('sha256').update(value).digest();
  if(!supplied||!timingSafeEqual(digest(supplied),digest(secret)))throw new HttpError(401,'Invalid automation credential');
}

export function checkAutomationJob(input:any,existing:any){
  if(!input||!['Discovered','Preparing','Ready for review'].includes(input.stage))throw new HttpError(403,'Automation may prepare applications; submission and interview status require human review');
  if(existing&&!['Discovered','Preparing','Ready for review'].includes(existing.stage))throw new HttpError(403,'Automation cannot change an application already managed by the applicant');
  if(input.stage==='Ready for review'){
    const kinds=new Set((existing?.documents||[]).map((d:any)=>d.kind));
    if(!kinds.has('Resume')||!kinds.has('Cover letter'))throw new HttpError(400,'Save the resume and cover letter before marking Ready for review');
  }
}
