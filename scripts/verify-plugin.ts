import assert from 'node:assert/strict';
import {randomUUID,randomBytes,createHash} from 'node:crypto';
import {betterAuth} from 'better-auth';
import {jwt} from 'better-auth/plugins/jwt';
import {mcp} from '@better-auth/mcp';
import {cimd} from '@better-auth/cimd';
import {getPool} from '../lib/db';
import {activePluginUser} from '../lib/plugin-authorization';
import {mcpResource} from '../lib/plugin-config';
const db=getPool(),suffix=randomUUID(),email='plugin-verification-'+suffix+'@example.invalid';
const base='https://plugin-verification.invalid',clientId=base+'/client-'+suffix+'.json',callback=base+'/callback';
const auth=betterAuth({database:db,secret:randomBytes(48).toString('hex'),baseURL:base,rateLimit:{enabled:false},emailAndPassword:{enabled:true,minPasswordLength:12},plugins:[jwt(),mcp({resource:mcpResource,loginPage:'/sign-in',consentPage:'/connect/consent',scopes:['openid','profile','email','offline_access','career:read','career:prepare'],grantTypes:['authorization_code','refresh_token']}),cimd({metadataProfile:'mcp-2026-07-28',fetchClientMetadataResource:async input=>{assert.equal(String(input),clientId);return Response.json({client_id:clientId,client_name:'Disposable verification fixture',redirect_uris:[callback],token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']})}})]});
let userId='';
async function request(path:string,init:RequestInit={}){return auth.handler(new Request(base+path,init))}
async function body(r:Response){const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data}
try{
 const discovery=await body(await request('/.well-known/oauth-authorization-server/api/auth'));assert.equal(discovery.client_id_metadata_document_supported,true);assert.ok(discovery.code_challenge_methods_supported.includes('S256'));
 const signup=await request('/api/auth/sign-up/email',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({name:'Disposable verification fixture',email,password:randomBytes(32).toString('hex')})});
 const data=await body(signup);userId=data.user.id;const cookie=signup.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');assert.ok(cookie);
 const verifier=randomBytes(48).toString('base64url'),challenge=createHash('sha256').update(verifier).digest('base64url');
 const params=new URLSearchParams({client_id:clientId,redirect_uri:callback,response_type:'code',scope:'openid profile email offline_access career:read career:prepare',resource:mcpResource,state:randomUUID(),code_challenge:challenge,code_challenge_method:'S256'});
 const authorization=await request('/api/auth/oauth2/authorize?'+params,{headers:{cookie}});assert.equal(authorization.status,302);const consentUrl=new URL(authorization.headers.get('location')!,base);assert.equal(consentUrl.pathname,'/connect/consent');
 const consent=await body(await request('/api/auth/oauth2/consent',{method:'POST',headers:{cookie,'Content-Type':'application/json',Origin:base},body:JSON.stringify({accept:true,oauth_query:consentUrl.search.slice(1)})}));
 const code=new URL(consent.url).searchParams.get('code');assert.ok(code);
 const tokenParams=new URLSearchParams({grant_type:'authorization_code',client_id:clientId,redirect_uri:callback,code:code!,code_verifier:verifier,resource:mcpResource});
 const tokens=await body(await request('/api/auth/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:tokenParams}));assert.ok(tokens.refresh_token);const claims=JSON.parse(Buffer.from(tokens.access_token.split('.')[1],'base64url').toString());assert.equal(claims.sub,userId);assert.ok([claims.aud].flat().includes(mcpResource));
 const context=await auth.$context;const grant=await activePluginUser(context.adapter,claims);assert.equal(grant.user.id,userId);assert.ok(grant.scopes.has('career:prepare'));
 const refresh=await body(await request('/api/auth/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:clientId,refresh_token:tokens.refresh_token,resource:mcpResource})}));assert.ok(refresh.access_token);
 const consents=await auth.api.getOAuthConsents({headers:new Headers({cookie})});assert.equal(consents.length,1);await auth.api.deleteOAuthConsent({headers:new Headers({cookie}),body:{id:consents[0].id}});await assert.rejects(()=>activePluginUser(context.adapter,claims));
 const replay=await request('/api/auth/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:tokenParams});assert.equal(replay.status,400);
 console.log('OAuth verification passed: CIMD, PKCE, consent, resource binding, code replay rejection, refresh and immediate disconnect.');
}finally{
 if(userId){const context=await auth.$context;await context.adapter.deleteMany({model:'oauthConsent',where:[{field:'userId',value:userId}]});await context.adapter.deleteMany({model:'oauthAccessToken',where:[{field:'userId',value:userId}]});await context.adapter.deleteMany({model:'oauthRefreshToken',where:[{field:'userId',value:userId}]});await context.adapter.deleteMany({model:'session',where:[{field:'userId',value:userId}]});await context.adapter.deleteMany({model:'account',where:[{field:'userId',value:userId}]});await context.adapter.delete({model:'user',where:[{field:'id',value:userId}]});}
 const context=await auth.$context;await context.adapter.deleteMany({model:'oauthClient',where:[{field:'clientId',value:clientId}]});await db.end();
}
