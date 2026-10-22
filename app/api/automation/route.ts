import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {authorizeAutomation,checkAutomationJob} from '@/lib/automation';
import {getPool} from '@/lib/db';
import {repository} from '@/lib/service';
import {HttpError,failure,json} from '@/lib/http';
import {limits} from '@/lib/config';

export const dynamic='force-dynamic';
async function owner(r:Request){
  authorizeAutomation(r.headers.get('authorization'),process.env.CAREER_AUTOMATION_TOKEN);
  const email=process.env.CAREER_AUTOMATION_EMAIL?.trim().toLowerCase();
  if(!email)throw new HttpError(503,'Automation owner is not configured');
  const result=await getPool().query('SELECT id,name,email FROM "user" WHERE lower(email)=$1',[email]);
  if(result.rows.length!==1)throw new HttpError(409,'Create the invited Career Desk account before connecting automation');
  return result.rows[0];
}
export async function GET(r:Request){try{
  const u=await owner(r),repo=repository();
  const documentId=new URL(r.url).searchParams.get('document');
  if(documentId){const doc=await repo.document(u.id,documentId);if(!doc)throw new HttpError(404,'Document not found');return new Response(new Uint8Array(doc.bytes),{headers:{'Content-Type':'application/pdf','Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="'+doc.name+'"'}});}
  if(new URL(r.url).searchParams.has('status'))return json({connected:true,profileReady:Boolean((await repo.profile(u.id,u.name,u.email)).onboarded)});
  const [jobs,profile,runs,usage]=await Promise.all([repo.jobs(u.id),repo.profile(u.id,u.name,u.email),repo.runs(u.id),repo.usage(u.id)]);
  return json({jobs,profile,runs,usage});
}catch(e){return failure(e)}}
export async function POST(r:Request){try{
  const u=await owner(r);
  if(Number(r.headers.get('content-length')||0)>3000000)throw new HttpError(413,'Request is too large');
  const body=await r.text();if(Buffer.byteLength(body)>3000000)throw new HttpError(413,'Request is too large');
  const {action,data}=JSON.parse(body),repo=repository();
  if(action==='save_job'){
    const existing=data?.id?(await repo.jobs(u.id)).find((job:any)=>job.id===data.id):null;
    checkAutomationJob(data,existing);return json(await repo.save(u.id,data,true));
  }
  if(action==='save_pdf'){
    const input=z.object({jobId:z.string(),name:z.string().max(180),kind:z.enum(['Resume','Cover letter']),base64:z.string().max(Math.ceil(limits.fileBytes/3)*4)}).parse(data);
    const existing=(await repo.jobs(u.id)).find((job:any)=>job.id===input.jobId);
    if(!existing)throw new HttpError(404,'Application not found');
    checkAutomationJob({...existing,stage:'Preparing'},existing);
    if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.base64))throw Error('Invalid PDF encoding');
    return json(await repo.saveDocument(u.id,input.jobId,input.name,input.kind,Buffer.from(input.base64,'base64'),true));
  }
  if(action==='record_run'){
    const value=z.object({summary:z.string().max(5000),sources:z.array(z.string().url()).max(50).default([]),added:z.number().int().min(0).max(250).default(0),status:z.string().max(80)}).parse(data);
    const run={...value,id:randomUUID(),at:new Date().toISOString()};
    await getPool().query('INSERT INTO career_runs(owner_id,id,payload) VALUES($1,$2,$3)',[u.id,run.id,JSON.stringify(run)]);return json(run);
  }
  throw new HttpError(400,'Unknown automation action');
}catch(e){return failure(e)}}
