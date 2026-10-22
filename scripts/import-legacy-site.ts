import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {getPool} from '../lib/db';
import {canonicalUrl,limits,stages} from '../lib/config';

// Explicit one-time operator migration; not exposed through the automation API.
const origin=process.env.LEGACY_SITE_ORIGIN;
const token=process.env.LEGACY_SITE_TOKEN;
const email=process.env.CAREER_AUTOMATION_EMAIL;
if(!origin||!token||!email)throw Error('Legacy migration configuration missing');
const site=new URL(origin);
if(site.protocol!=='https:'||!site.hostname.endsWith('.chatgpt.site'))throw Error('Expected a private ChatGPT Site');
async function read(path:string){const url=new URL(path,site);if(url.origin!==site.origin)throw Error('Cross-origin source rejected');const r=await fetch(url,{headers:{'OAI-Sites-Authorization':'Bearer '+token},redirect:'error'});if(!r.ok)throw Error('Legacy source request failed: '+r.status);return r;}
const source=await (await read('/api/agent')).json();
if(!Array.isArray(source.jobs)||source.jobs.length>limits.jobs)throw Error('Invalid source jobs');
const prepared=[];
for(const job of source.jobs){
 if(!job.id||!job.company||!job.title||!stages.includes(job.stage))throw Error('Invalid source application');
 const documents=[];const hashes=new Set<string>();
 for(const doc of [...(job.documents||[])].reverse()){
  if(!['Resume','Cover letter'].includes(doc.kind))throw Error('Invalid source document kind');
  const bytes=Buffer.from(await (await read(doc.url)).arrayBuffer());
  if(bytes.length>limits.fileBytes||bytes.subarray(0,5).toString()!=='%PDF-')throw Error('Invalid source PDF');
  const hash=createHash('sha256').update(bytes).digest('hex');
  if(hashes.has(hash))continue;hashes.add(hash);
  documents.push({id:randomUUID(),name:doc.name.replace(/[^a-zA-Z0-9._-]/g,'-').slice(0,180),kind:doc.kind,bytes,createdAt:doc.createdAt,hash});
 }
 prepared.push({job,documents});
}
const pool=getPool(),db=await pool.connect();
try{
 await db.query('BEGIN');
 const users=await db.query('SELECT id FROM "user" WHERE lower(email)=$1',[email.toLowerCase()]);
 if(users.rows.length!==1)throw Error('Create the invited account first');
 const owner=users.rows[0].id;
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',[owner]);
 const prior=await db.query('SELECT id FROM career_runs WHERE owner_id=$1 AND id=$2',[owner,'legacy-site-migration-v1']);
 if(prior.rowCount){console.log('Legacy migration already completed; no changes');await db.query('ROLLBACK');}
 else{
  const count=await db.query('SELECT count(*)::int AS n FROM career_jobs WHERE owner_id=$1',[owner]);
  if(count.rows[0].n!==0)throw Error('Destination has applications; reconcile before importing');
  const current=await db.query('SELECT payload FROM career_profiles WHERE owner_id=$1',[owner]);
  const profile=current.rows[0]?.payload?.onboarded?current.rows[0].payload:{...source.profile,onboarded:true};
  await db.query('INSERT INTO career_profiles(owner_id,payload) VALUES($1,$2) ON CONFLICT(owner_id) DO NOTHING',[owner,JSON.stringify(profile)]);
  if(!current.rows[0]?.payload?.onboarded)await db.query('UPDATE career_profiles SET payload=$2 WHERE owner_id=$1',[owner,JSON.stringify(profile)]);
  let documentCount=0,totalBytes=0;
  for(const {job,documents} of prepared){
   const migrated={...job,url:canonicalUrl(job.url||''),documents:[],migration:{source:'Private Career Desk Site',at:new Date().toISOString()},history:[...(job.history||[])]};
   await db.query('INSERT INTO career_jobs(owner_id,id,canonical_url,payload) VALUES($1,$2,$3,$4)',[owner,job.id,migrated.url||null,JSON.stringify(migrated)]);
   const metadata:Array<{id:string;name:string;kind:string;url:string;createdAt:string;size:number;sha256:string;version:number}>=[];
   for(const doc of documents){
    documentCount++;totalBytes+=doc.bytes.length;
    if(documentCount>limits.documents||totalBytes>limits.storageBytes)throw Error('Migration exceeds storage quota');
    await db.query('INSERT INTO career_documents(owner_id,id,job_id,name,kind,size_bytes,bytes) VALUES($1,$2,$3,$4,$5,$6,$7)',[owner,doc.id,job.id,doc.name,doc.kind,doc.bytes.length,doc.bytes]);
    const stored=await db.query('SELECT bytes FROM career_documents WHERE owner_id=$1 AND id=$2',[owner,doc.id]);assert.deepEqual(stored.rows[0].bytes,doc.bytes);
    metadata.push({id:doc.id,name:doc.name,kind:doc.kind,url:'/api/documents/'+doc.id,createdAt:doc.createdAt,size:doc.bytes.length,sha256:doc.hash,version:metadata.filter(d=>d.kind===doc.kind).length+1});
   }
   await db.query('UPDATE career_jobs SET payload=$3 WHERE owner_id=$1 AND id=$2',[owner,job.id,JSON.stringify({...migrated,documents:metadata})]);
  }
  for(const run of source.runs||[])await db.query('INSERT INTO career_runs(owner_id,id,payload) VALUES($1,$2,$3)',[owner,randomUUID(),JSON.stringify(run)]);
  const run={at:new Date().toISOString(),status:'Migration verified',summary:`Imported ${prepared.length} existing applications and ${documentCount} unique PDFs; PDF bytes verified. This was setup, not a job search.`,added:0,sources:[site.origin]};
  await db.query('INSERT INTO career_runs(owner_id,id,payload) VALUES($1,$2,$3)',[owner,'legacy-site-migration-v1',JSON.stringify(run)]);
  await db.query('COMMIT');console.log(`Legacy migration verified: ${prepared.length} applications, ${documentCount} PDFs, byte-for-byte verification passed`);
 }
}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();await pool.end();}
