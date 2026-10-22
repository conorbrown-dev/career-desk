import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertWorkspaceActive} from '../lib/account-lifecycle';
test('deleted workspace guard blocks stale requests and permits active owners',async()=>{
 let observed:unknown[]=[];
 const db={async query(_sql:string,args?:unknown[]){observed=args||[];return {rows:args?.[0]==='deleted'?[{owner_id:'deleted'}]:[]}}};
 await assertWorkspaceActive(db,'active');await assert.rejects(()=>assertWorkspaceActive(db,'deleted'),/deleted/);assert.deepEqual(observed,['deleted']);
});
