import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {getPool} from '../lib/db';
import {Repository} from '../lib/repository';
import {AssistantTools} from '../lib/assistant-tools';
const db=getPool(),repo=new Repository(db),owner='lifecycle-'+randomUUID(),other='lifecycle-'+randomUUID();
try{
 for(const id of [owner,other])await db.query('INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt") VALUES($1,$2,$3,true,NOW(),NOW())',[id,'Disposable lifecycle fixture',id+'@example.test']);
 const sessionToken='lifecycle-session-'+randomUUID();await db.query(`INSERT INTO session(id,token,"userId","expiresAt","createdAt","updatedAt") VALUES($1,$2,$3,NOW()+INTERVAL '1 hour',NOW(),NOW())`,[randomUUID(),sessionToken,owner]);
 const job=await repo.save(owner,{company:'Disposable fixture',title:'Test',stage:'Discovered'});
 await repo.saveDocument(owner,job.id,'fixture.pdf','Resume',Buffer.from('%PDF-1.4\nfixture\n%%EOF'));
 const tools=new AssistantTools(db,{id:owner,name:'Fixture',email:owner+'@example.test'},new Set(['career:read','career:prepare']));
 await tools.recordRun({summary:'Disposable lifecycle check',sources:[],added:0,status:'Setup'});
 for(let i=0;i<10;i++)await repo.reserveImport(owner);
 await assert.rejects(()=>repo.reserveImport(owner),/wait a minute/);
 const otherJob=await repo.save(other,{company:'Unrelated fixture',title:'Test',stage:'Discovered'});
 await db.query('DELETE FROM "user" WHERE id=$1',[owner]);
 assert.equal(Number((await db.query('SELECT count(*) AS count FROM session WHERE "userId"=$1',[owner])).rows[0].count),0,'Deleting a user must cascade to sessions');
 for(const table of ['career_jobs','career_documents','career_profiles','career_runs','career_plugin_usage'])assert.equal(Number((await db.query('SELECT count(*) AS count FROM '+table+' WHERE owner_id=$1',[owner])).rows[0].count),0);
 assert.equal(Number((await db.query('SELECT count(*) AS count FROM career_plugin_usage WHERE owner_id=$1',['import:'+owner])).rows[0].count),0,'Deletion removes import rate limit state');
 await assert.rejects(()=>repo.reserveImport(owner),/deleted/);
 assert.equal((await repo.jobs(other))[0].id,otherJob.id);
 await assert.rejects(()=>repo.save(owner,{company:'Stale write',title:'Test',stage:'Discovered'}),/deleted/);
 await assert.rejects(()=>tools.recordRun({summary:'Stale activity',sources:[],added:0,status:'Setup'}),/deleted/);
 console.log('Account lifecycle passed: transactional workspace deletion, unrelated owner preservation, stale write denial');
}finally{
 for(const id of [owner,other]){await db.query('DELETE FROM "user" WHERE id=$1',[id]);for(const table of ['career_documents','career_jobs','career_profiles','career_runs','career_plugin_usage','career_deleted_owners'])await db.query('DELETE FROM '+table+' WHERE owner_id=$1',[id]);}
 await db.end();
}
