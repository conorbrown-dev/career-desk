import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {getPool} from '../lib/db';
import {Repository} from '../lib/repository';
import {restoreBackup} from '../lib/backup';
import {blankProfile} from '../lib/config';

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
  console.log('PostgreSQL verification passed: atomic backup restore with remapped IDs, persistence, owner isolation, PDF round trip, export');
} finally {
  for(const id of [owner,other]){await db.query('DELETE FROM career_jobs WHERE owner_id=$1',[id]);await db.query('DELETE FROM career_profiles WHERE owner_id=$1',[id]);await db.query('DELETE FROM career_runs WHERE owner_id=$1',[id]);}
  await db.end();
}
