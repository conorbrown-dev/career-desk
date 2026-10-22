import {requireMcpAuth} from '@better-auth/mcp';
import {createMcpHandler} from '@modelcontextprotocol/server';
import {getAuth} from '@/lib/auth';
import {mcpResource} from '@/lib/plugin-config';
import {activePluginUser} from '@/lib/plugin-authorization';
import {AssistantTools,createCareerMcp} from '@/lib/assistant-tools';
import {getPool} from '@/lib/db';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 if(Number(request.headers.get('content-length')||0)>3000000)return Response.json({error:'Request is too large'},{status:413});
 return requireMcpAuth(getAuth(),async(r,claims)=>{
  const context=await getAuth().$context;
  let grant;try{grant=await activePluginUser(context.adapter,claims)}catch{return Response.json({error:'Reconnect Career Desk to authorize this account.'},{status:401,headers:{'WWW-Authenticate':`Bearer resource_metadata="${new URL('/.well-known/oauth-protected-resource',mcpResource).href}"`}})}
  const db=getPool();
  const quota=await db.query('INSERT INTO career_plugin_usage(owner_id,window_start,count) VALUES($1,date_trunc(\'minute\',NOW()),1) ON CONFLICT(owner_id) DO UPDATE SET count=CASE WHEN career_plugin_usage.window_start=date_trunc(\'minute\',NOW()) THEN career_plugin_usage.count+1 ELSE 1 END,window_start=date_trunc(\'minute\',NOW()) RETURNING count',[grant.user.id]);
  if(quota.rows[0].count>60)return Response.json({error:'Connection request limit reached. Try again in a minute.'},{status:429,headers:{'Retry-After':'60'}});
  const handler=createMcpHandler(()=>createCareerMcp(new AssistantTools(db,grant.user,grant.scopes)),{legacy:'reject'});
  const reader=r.body?.getReader(),chunks:Uint8Array[]=[];let size=0;
  if(reader)try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>3000000){await reader.cancel();return Response.json({error:'Request is too large'},{status:413})}chunks.push(part.value)}}finally{reader.releaseLock()}
  const bytes=Buffer.concat(chunks);
  return handler.fetch(new Request(r.url,{method:r.method,headers:r.headers,body:bytes}));
 },{resource:mcpResource,requiredScopes:['career:read']})(request);
}
