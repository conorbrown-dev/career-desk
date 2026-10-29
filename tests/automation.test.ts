import {test} from 'node:test';
import assert from 'node:assert/strict';
import {authorizeAutomation,checkAutomationJob} from '../lib/automation';
test('automation fails closed and accepts only its own bearer credential',()=>{
 const secret='test-only-'.repeat(6);
 assert.throws(()=>authorizeAutomation(null,secret),/Invalid/);
 assert.throws(()=>authorizeAutomation('Bearer '+secret,undefined),/not configured/);
 assert.throws(()=>authorizeAutomation('Bearer '+'x'.repeat(secret.length),secret),/Invalid/);
 assert.doesNotThrow(()=>authorizeAutomation('Bearer '+secret,secret));
});
test('automation cannot claim submission or overwrite applicant-managed stages',()=>{
 assert.throws(()=>checkAutomationJob({stage:'Applied'},null),/human review/);
 assert.throws(()=>checkAutomationJob({stage:'Preparing'},{stage:'Interview'}),/applicant/);
 assert.throws(()=>checkAutomationJob({stage:'Ready for review',documents:[{kind:'Resume'},{kind:'Cover letter'}]},null),/Save the resume/);
 assert.doesNotThrow(()=>checkAutomationJob({stage:'Ready for review'},{stage:'Preparing',documents:[{kind:'Resume'},{kind:'Cover letter'}]}));
});
test('automation cannot mark a posting Not pursuing or revive one the applicant passed on',()=>{
 assert.throws(()=>checkAutomationJob({stage:'Not pursuing'},null),/human review/);
 assert.throws(()=>checkAutomationJob({stage:'Discovered'},{stage:'Not pursuing'}),/applicant/);
});
