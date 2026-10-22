import {assertWorkspaceActive} from './account-lifecycle';
import {reserveDocumentBudget} from './storage-budget';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {canonicalUrl,limits,stages} from './config';
import type {Database} from './repository';
const text=z.string();
const profileSchema=z.object({name:text.trim().min(1).max(150),email:text.email(),criteria:z.object({minimumBase:z.number().nonnegative().max(10000000),roles:text.max(3000),remote:text.max(1000),degree:text.max(1000),targetBase:text.max(1000)}),experience:z.record(text,text.max(12000)),rules:z.array(text.max(1000)).max(30)}).passthrough();
const historySchema=z.array(z.object({at:text.max(100),text:text.max(2000)})).max(1000);
const jobSchema=z.object({id:text.min(1).max(100),company:text.trim().min(1).max(200),title:text.trim().min(1).max(300),stage:z.enum(stages),url:text.max(2000).default(''),appliedDate:text.max(10).optional(),history:historySchema.optional(),minBase:z.number().nonnegative().nullable().optional(),maxBase:z.number().nonnegative().nullable().optional()}).passthrough();
const backupSchema=z.object({format:z.literal('career-desk-v1'),profile:profileSchema,jobs:z.array(jobSchema).max(limits.jobs),documents:z.array(z.object({id:text.min(1).max(100),job_id:text.min(1).max(100),name:text.min(1).max(180),kind:z.enum(['Resume','Cover letter']),base64:text.max(Math.ceil(limits.fileBytes/3)*4)})).max(limits.documents)});
/** Validate all bytes and references before opening a transaction. Never trust source ownership or download URLs. */
export function prepareRestore(input:unknown){
 if(JSON.stringify(input).length>45000000)throw Error('Backup exceeds the supported account size');
 const backup=backupSchema.parse(input);
 if(JSON.stringify(backup.profile).length>60000)throw Error('Backup profile is too large');
 for(const field of ['portfolio','linkedin'])if(backup.profile[field])canonicalUrl(String(backup.profile[field]));
 const ids=new Set<string>(),urls=new Set<string>();
 for(const job of backup.jobs){if(ids.has(job.id))throw Error('Backup contains duplicate application IDs');ids.add(job.id);if(JSON.stringify(job).length>100000)throw Error('Backup application is too large');job.url=canonicalUrl(job.url);if(job.url&&urls.has(job.url))throw Error('Backup contains duplicate posting URLs');if(job.url)urls.add(job.url);if(job.minBase&&job.maxBase&&job.maxBase<job.minBase)throw Error('Invalid compensation range in backup');}
 const documentIds=new Set<string>();let total=0;
 const documents=backup.documents.map(d=>{if(!ids.has(d.job_id))throw Error('Backup document refers to a missing application');if(documentIds.has(d.id))throw Error('Backup contains duplicate document IDs');documentIds.add(d.id);if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(d.base64))throw Error('Backup contains invalid document encoding');const bytes=Buffer.from(d.base64,'base64');if(bytes.length>limits.fileBytes||bytes.subarray(0,5).toString()!=='%PDF-'||!d.name.toLowerCase().endsWith('.pdf'))throw Error('Backup contains an invalid or oversized PDF');total+=bytes.length;return {...d,bytes}});
 if(total>limits.storageBytes)throw Error('Backup exceeds account document storage');
 return {...backup,documents};
}
/** Empty-workspace restore: all records commit together or none do. Source IDs are remapped. */
export async function restoreBackup(db:Database,owner:string,input:unknown){
 const backup=prepareRestore(input);if(!db.connect)throw Error('Transactional restore is unavailable');
 const client=await db.connect();try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner]);
  await assertWorkspaceActive(client,owner);
  const jobs=await client.query('SELECT COUNT(*)::int AS count FROM career_jobs WHERE owner_id=$1',[owner]);
  const docs=await client.query('SELECT COUNT(*)::int AS count FROM career_documents WHERE owner_id=$1',[owner]);
  const profiles=await client.query('SELECT payload FROM career_profiles WHERE owner_id=$1',[owner]);
  if(jobs.rows[0].count||docs.rows[0].count||profiles.rows[0]?.payload?.onboarded)throw Error('Restore requires an empty workspace. Existing data was not changed.');
  await reserveDocumentBudget(client,backup.documents.reduce((sum,d)=>sum+d.bytes.length,0));
  const at=new Date().toISOString(),jobIds=new Map(backup.jobs.map(job=>[job.id,randomUUID()]));
  const newDocs=backup.documents.map(d=>({...d,id:randomUUID(),job_id:jobIds.get(d.job_id)!}));
  for(const original of backup.jobs){const id=jobIds.get(original.id)!;const versions:Record<string,number>={};const documents=newDocs.filter(d=>d.job_id===id).map(d=>({id:d.id,name:d.name.replace(/[^a-zA-Z0-9._-]/g,'-'),kind:d.kind,url:'/api/documents/'+d.id,createdAt:at,size:d.bytes.length,version:versions[d.kind]=(versions[d.kind]||0)+1}));const job={...original,id,documents,history:[...(original.history||[]),{at,text:'Restored from an account backup'}],updatedAt:at};await client.query('INSERT INTO career_jobs(owner_id,id,canonical_url,payload,updated_at) VALUES($1,$2,$3,$4,NOW())',[owner,id,job.url||null,JSON.stringify(job)]);}
  for(const d of newDocs)await client.query('INSERT INTO career_documents(owner_id,id,job_id,name,kind,size_bytes,bytes) VALUES($1,$2,$3,$4,$5,$6,$7)',[owner,d.id,d.job_id,d.name.replace(/[^a-zA-Z0-9._-]/g,'-'),d.kind,d.bytes.length,d.bytes]);
  await client.query('INSERT INTO career_profiles(owner_id,payload) VALUES($1,$2) ON CONFLICT(owner_id) DO UPDATE SET payload=excluded.payload',[owner,JSON.stringify({...backup.profile,onboarded:true})]);
  const run={id:randomUUID(),at,status:'Backup restored',added:0,sources:[],summary:`Restored ${backup.jobs.length} applications and ${backup.documents.length} PDFs from an account backup. No application was submitted.`};
  await client.query('INSERT INTO career_runs(owner_id,id,payload) VALUES($1,$2,$3)',[owner,run.id,JSON.stringify(run)]);
  await client.query('COMMIT');return {applications:backup.jobs.length,documents:backup.documents.length};
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
