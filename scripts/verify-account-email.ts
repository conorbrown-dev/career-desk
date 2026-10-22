import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {betterAuth} from 'better-auth';
import {createEmailVerificationToken} from 'better-auth/api';
import {getPool} from '../lib/db';
import {accountEmailOptions} from '../lib/account-email';
const db=getPool(),suffix=randomUUID(),email=`email-check-${suffix}@example.invalid`,base='https://account-check.invalid',secret=randomBytes(48).toString('hex');
const messages:{to:string;kind:string;url:string}[]=[];
const options=accountEmailOptions(async message=>{messages.push(message)},base);
const auth=betterAuth({database:db,baseURL:base,secret,rateLimit:{enabled:false},...options});
let userId='';
async function request(path:string,body?:unknown,cookie?:string){return auth.handler(new Request(base+'/api/auth'+path,{method:body?'POST':'GET',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})}))}
const password=randomBytes(24).toString('hex'),replacement=randomBytes(24).toString('hex');
try{
 const signup=await request('/sign-up/email',{email,name:'Disposable email fixture',password});assert.equal(signup.status,200);const data=await signup.json();userId=data.user.id;assert.equal(data.token,null);assert.equal(messages[0]?.kind,'verification');
 assert.equal((await request('/sign-in/email',{email,password})).status,403,'Unverified sign-in must fail');
 const verify=new URL(messages[0].url);assert.equal((await auth.handler(new Request(verify))).status,302);
 const signin=await request('/sign-in/email',{email,password});assert.equal(signin.status,200);const cookie=signin.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');assert.ok(cookie);
 const unknown=await request('/request-password-reset',{email:'missing-'+suffix+'@example.invalid',redirectTo:base+'/reset-password'});const reset=await request('/request-password-reset',{email,redirectTo:base+'/reset-password'});assert.equal(reset.status,unknown.status);assert.deepEqual(await reset.json(),await unknown.json());assert.equal(messages.length,2);
 const link=new URL(messages[1].url);assert.equal(link.pathname,'/reset-password');assert.equal(link.search,'');const token=new URLSearchParams(link.hash.slice(1)).get('token');assert.ok(token);
 assert.equal((await request('/reset-password',{token,newPassword:replacement})).status,200);
 assert.equal((await request('/reset-password',{token,newPassword:password})).status,400,'Reset token cannot be reused');
 assert.equal(await (await request('/get-session',undefined,cookie)).json(),null,'Reset revokes the old session');
 assert.equal((await request('/sign-in/email',{email,password})).status,401);assert.equal((await request('/sign-in/email',{email,password:replacement})).status,200);
 await request('/request-password-reset',{email});const expired=new URLSearchParams(new URL(messages.at(-1)!.url).hash.slice(1)).get('token');await db.query('UPDATE verification SET "expiresAt"=$1 WHERE identifier=$2',[new Date(Date.now()-60000),'reset-password:'+expired]);assert.equal((await request('/reset-password',{token:expired,newPassword:password})).status,400);
 const expiredVerification=await createEmailVerificationToken(secret,email,undefined,-60);assert.equal((await request('/verify-email?token='+expiredVerification)).status,401);
 const deletionSignin=await request('/sign-in/email',{email,password:replacement});
 const deletionCookie=deletionSignin.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');
 assert.equal((await request('/delete-user',{callbackURL:base+'/done'},deletionCookie)).status,200);
 assert.equal(messages.at(-1)!.kind,'deletion');
 const deletionUrl=new URL(messages.at(-1)!.url),deletionToken=deletionUrl.searchParams.get('token');assert.ok(deletionToken);
 await db.query('UPDATE verification SET "expiresAt"=$1 WHERE identifier=$2',[new Date(Date.now()-60000),'delete-account-'+deletionToken]);
 assert.ok((await auth.handler(new Request(deletionUrl,{headers:{cookie:deletionCookie}}))).status>=400,'Expired deletion must fail');
 assert.equal((await db.query('SELECT id FROM "user" WHERE id=$1',[userId])).rows.length,1);
 await request('/delete-user',{callbackURL:base+'/done'},deletionCookie);
 const finalDeletionUrl=new URL(messages.at(-1)!.url);
 assert.equal((await auth.handler(new Request(finalDeletionUrl,{headers:{cookie:deletionCookie}}))).status,302);
 assert.equal((await db.query('SELECT id FROM "user" WHERE id=$1',[userId])).rows.length,0);
 assert.equal(await (await request('/get-session',undefined,deletionCookie)).json(),null);
 assert.ok((await auth.handler(new Request(finalDeletionUrl,{headers:{cookie:deletionCookie}}))).status>=400,'Deleted link cannot be reused');
 console.log('Account email checks passed: verification required, token expiry, generic reset response, fragment link, one-time reset, password change and session revocation. No email was sent.');
}finally{
 const context=await auth.$context;if(userId){await context.adapter.deleteMany({model:'verification',where:[{field:'value',value:userId}]});await context.adapter.deleteMany({model:'session',where:[{field:'userId',value:userId}]});await context.adapter.deleteMany({model:'account',where:[{field:'userId',value:userId}]});await context.adapter.delete({model:'user',where:[{field:'id',value:userId}]});}await db.end();
}
