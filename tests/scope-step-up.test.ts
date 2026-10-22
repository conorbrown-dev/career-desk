import {test} from 'node:test';
import assert from 'node:assert/strict';
import {missingToolScopes,scopeStepUpResponse,supportsScopeStepUp,toolScopes} from '../lib/plugin-authorization';

test('only Claude hosted client metadata documents receive scope step-up challenges',()=>{
 for(const id of ['https://claude.ai/oauth/mcp-client-metadata','https://claude.com/oauth/client','https://claude.ai/oauth/claude-code-client-metadata'])assert.equal(supportsScopeStepUp(id),true,id);
 for(const id of ['https://chatgpt.com/oauth/client','http://claude.ai/oauth/client','https://claude.ai.example.com/x','https://evilclaude.ai/x','abc123',undefined,42])assert.equal(supportsScopeStepUp(id),false,String(id));
});

test('every MCP tool maps to exactly one Career Desk scope',()=>{
 assert.deepEqual(Object.keys(toolScopes).sort(),['get_profile','list_applications','list_discovery_activity','read_document','record_discovery_run','save_opportunity','save_preparation_pdf','update_profile']);
 assert.ok(Object.values(toolScopes).every(scope=>['career:read','career:prepare','career:profile:write'].includes(scope)));
});

test('write tools without their scope are detected before the tool runs',()=>{
 const read=new Set(['openid','offline_access','career:read']);
 const call=(name:string,id=1)=>({jsonrpc:'2.0',id,method:'tools/call',params:{name,arguments:{}}});
 assert.deepEqual(missingToolScopes(call('get_profile'),read),[]);
 assert.deepEqual(missingToolScopes({jsonrpc:'2.0',id:1,method:'tools/list'},read),[]);
 assert.deepEqual(missingToolScopes(call('save_opportunity'),read),['career:prepare']);
 assert.deepEqual(missingToolScopes(call('update_profile'),read),['career:profile:write']);
 assert.deepEqual(missingToolScopes([call('save_preparation_pdf',1),call('update_profile',2),call('record_discovery_run',3)],read).sort(),['career:prepare','career:profile:write']);
 assert.deepEqual(missingToolScopes(call('save_opportunity'),new Set([...read,'career:prepare'])),[]);
 assert.deepEqual(missingToolScopes(call('unknown_tool'),read),[]);
 for(const body of [null,'text',42,{method:'tools/call'},{method:'tools/call',params:{name:{}}}])assert.deepEqual(missingToolScopes(body,read),[]);
});

test('step-up challenge is a 403 that keeps existing grants and never adds unrequested scopes',async()=>{
 const response=scopeStepUpResponse(new Set(['openid','offline_access','career:read']),['career:prepare']);
 assert.equal(response.status,403);
 const header=response.headers.get('WWW-Authenticate')||'';
 assert.match(header,/^Bearer error="insufficient_scope"/);
 assert.match(header,/scope="openid offline_access career:read career:prepare"/);
 assert.doesNotMatch(header,/career:profile:write/);
 assert.match(header,/resource_metadata="http[^"]+\/\.well-known\/oauth-protected-resource\/mcp"/);
 assert.equal((await response.json()).error,'insufficient_scope');
});
