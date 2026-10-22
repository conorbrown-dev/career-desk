import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {getPool} from '../lib/db';
import {Repository} from '../lib/repository';
import {restoreBackup} from '../lib/backup';
import {blankProfile} from '../lib/config';
import {diagnosticsTableSql,moveSetupRunsSql} from '../lib/deployment-diagnostics';

// Disposable, uniquely scoped records exercise the real PostgreSQL connection.
const db=getPool();
const repository=new Repository(db);
const owner='verification-'+randomUUID();
const other='verification-'+randomUUID();
try {
  const profile=blankProfile('Disposable fixture','fixture@example.test');profile.criteria.roles='Software Engineer';profile.criteria.remote='Remote';profile.experience.summary='Disposable verification evidence';await repository.saveProfile(owner,profile);
  const job=await repository.save(owner,{company:'Verification fixture',title:'Disposable fixture',stage:'Discovered',url:'https://example.com/'+randomUUID()});
  assert.equal((await repository.jobs(owner)).length,1);
  assert.equal((await repository.jobs(other)).length,0);
  await assert.rejects(repository.save(other,{...job,company:'Unauthorized overwrite'}));
  const bytes=Buffer.from('%PDF-1.4\n% Disposable verification fixture\n%%EOF');
  const updated=await repository.saveDocument(owner,job.id,'verification.pdf','Resume',bytes);
  const documentId=updated.documents[0].id;
  assert.deepEqual((await repository.document(owner,documentId)).bytes,bytes);
  assert.equal(await repository.document(other,documentId),null);
  assert.equal((await repository.backup(owner)).documents[0].base64,bytes.toString('base64'));
  await repository.save(owner,{...updated,stage:'Applied',appliedDate:'2026-10-22'});
  await assert.rejects(()=>repository.save(owner,{...updated,stage:'Preparing'},true),/applicant/);
  await assert.rejects(()=>repository.saveDocument(owner,job.id,'blocked.pdf','Resume',bytes,true),/applicant/);
  const backup=await repository.backup(owner);
  const restored=await restoreBackup(db,other,backup);assert.equal(restored.applications,1);assert.equal(restored.documents,1);
  const restoredJob=(await repository.jobs(other))[0];assert.notEqual(restoredJob.id,job.id);assert.equal(restoredJob.company,job.company);assert.equal(restoredJob.stage,'Applied');assert.notEqual(restoredJob.documents[0].id,documentId);assert.deepEqual((await repository.document(other,restoredJob.documents[0].id)).bytes,bytes);
  await assert.rejects(()=>restoreBackup(db,owner,backup),/empty workspace/);
  assert.equal((await repository.jobs(owner)).length,1);
  // Setup failures leave the workspace activity feed for operator diagnostics; ordinary activity stays.
  await db.query(diagnosticsTableSql);
  await db.query('INSERT INTO career_runs(owner_id,id,payload) VALUES($1,$2,$3),($1,$4,$5)',[owner,'setup-failure',JSON.stringify({status:'Setup failed',summary:'ChatGPT connection deployment failed during verification fixture. Diagnostic: none'}),'ordinary-run',JSON.stringify({status:'Setup',summary:'Disposable connection check'})]);
  await db.query(moveSetupRunsSql);
  assert.deepEqual((await db.query('SELECT id FROM career_runs WHERE owner_id=$1 ORDER BY id',[owner])).rows.map((r:any)=>r.id),['ordinary-run']);
  assert.equal((await db.query('SELECT stage FROM deployment_diagnostics WHERE id=$1',['run:'+owner+':setup-failure'])).rows[0]?.stage,'legacy activity entry');
  console.log('PostgreSQL verification passed: atomic backup restore with remapped IDs, persistence, owner isolation, PDF round trip, export, setup diagnostics kept out of activity');
} finally {
  for(const id of [owner,other]){await db.query('DELETE FROM career_jobs WHERE owner_id=$1',[id]);await db.query('DELETE FROM career_profiles WHERE owner_id=$1',[id]);await db.query('DELETE FROM career_runs WHERE owner_id=$1',[id]);await db.query('DELETE FROM deployment_diagnostics WHERE id LIKE $1',['run:'+id+':%']).catch(()=>{});}
  await db.end();
}
