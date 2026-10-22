import {mcpResource,pluginScopes} from './plugin-config';
export interface GrantAdapter{findOne:(args:any)=>Promise<any>;findMany:(args:any)=>Promise<any[]>}
export async function activePluginUser(adapter:GrantAdapter,claims:{sub?:unknown;client_id?:unknown;scope?:unknown}){
 if(typeof claims.sub!=='string'||typeof claims.client_id!=='string'||typeof claims.scope!=='string')throw Error('A delegated user token is required');
 const [user,client,consents]=await Promise.all([
  adapter.findOne({model:'user',where:[{field:'id',value:claims.sub}]}),
  adapter.findOne({model:'oauthClient',where:[{field:'clientId',value:claims.client_id}]}),
  adapter.findMany({model:'oauthConsent',where:[{field:'userId',value:claims.sub},{field:'clientId',value:claims.client_id}]})
 ]);
 if(!user||client?.disabled||!consents.length)throw Error('This connection is no longer authorized');
 const granted=new Set<string>(consents.filter(c=>!c.referenceId&&Array.isArray(c.resources)&&c.resources.includes(mcpResource)).flatMap(c=>c.scopes||[]));
 const scopes=new Set(claims.scope.split(' ').filter(scope=>granted.has(scope)));
 if(!scopes.has('career:read'))throw Error('This connection no longer has workspace access');
 return {user:{id:user.id,name:user.name,email:user.email},scopes};
}

// Scope each MCP tool needs. Tools still enforce this themselves; this map lets the HTTP layer ask for step-up first.
export const toolScopes:Record<string,string>={get_profile:'career:read',list_applications:'career:read',read_document:'career:read',list_discovery_activity:'career:read',save_opportunity:'career:prepare',save_preparation_pdf:'career:prepare',record_discovery_run:'career:prepare',update_profile:'career:profile:write'};
// Claude re-authorizes only on an HTTP 403 insufficient_scope challenge sent before the tool runs. Limit the challenge to
// Claude's hosted client metadata documents so other assistants keep receiving the tool-level permission error.
export function supportsScopeStepUp(clientId:unknown){if(typeof clientId!=='string')return false;try{const url=new URL(clientId);return url.protocol==='https:'&&['claude.ai','claude.com'].includes(url.hostname)}catch{return false}}
export function missingToolScopes(body:unknown,granted:Set<string>){
 const missing=new Set<string>();
 for(const message of Array.isArray(body)?body:[body]){
  if(!message||typeof message!=='object'||(message as any).method!=='tools/call')continue;
  const needed=toolScopes[(message as any).params?.name];
  if(needed&&!granted.has(needed))missing.add(needed);
 }
 return [...missing];
}
export function scopeStepUpResponse(granted:Set<string>,missing:string[]){
 // Request everything still needed, not only the missing scope, so earlier grants carry into the new consent.
 const scope=pluginScopes.filter(s=>granted.has(s)||missing.includes(s)).join(' ');
 const metadata=new URL('/.well-known/oauth-protected-resource/mcp',mcpResource).href;
 return Response.json({error:'insufficient_scope',error_description:'Approve additional Career Desk access for this action.'},{status:403,headers:{'WWW-Authenticate':`Bearer error="insufficient_scope", scope="${scope}", resource_metadata="${metadata}"`}});
}
