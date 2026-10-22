import {mcpResource} from './plugin-config';
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
