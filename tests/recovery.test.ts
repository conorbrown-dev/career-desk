import {test} from 'node:test';
import assert from 'node:assert/strict';
import {recoveryGrant} from '../lib/recovery';
test('operator recovery fails closed, expires and is bound to one existing account',()=>{
 const env={CAREER_RECOVERY_EMAIL:'owner@example.test',CAREER_RECOVERY_TOKEN:'test-only-'.repeat(6),CAREER_RECOVERY_EXPIRES:new Date(Date.now()+60000).toISOString()};
 assert.throws(()=>recoveryGrant('owner@example.test',{}),/closed/);
 assert.throws(()=>recoveryGrant('other@example.test',env),/not enabled/);
 assert.throws(()=>recoveryGrant('owner@example.test',{...env,CAREER_RECOVERY_EXPIRES:new Date(0).toISOString()}),/closed/);
 assert.equal(recoveryGrant('OWNER@example.test',env),env.CAREER_RECOVERY_TOKEN);
});
