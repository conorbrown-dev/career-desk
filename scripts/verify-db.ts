import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {getPool} from '../lib/db';
import {Repository} from '../lib/repository';

// Disposable, uniquely scoped records exercise the real PostgreSQL connection.
const db=getPool();
const repository=new Repository(db);
const owner='verification-'+randomUUID();
const other='verification-'+randomUUID();
try {
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
  console.log('PostgreSQL verification passed: persistence, owner isolation, PDF round trip, export');
} finally {
  await db.query('DELETE FROM career_jobs WHERE owner_id=$1',[owner]);
  await db.end();
}
