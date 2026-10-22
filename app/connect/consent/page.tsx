import {headers} from 'next/headers';
import {getAuth} from '@/lib/auth';
import {verifyOAuthQueryParams} from '@better-auth/oauth-provider';
import {pluginScopes,scopeLabels} from '@/lib/plugin-config';
import Consent from './consent';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false}};
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 const values=await searchParams,query=new URLSearchParams();for(const [key,value] of Object.entries(values))for(const part of Array.isArray(value)?value:value?[value]:[])query.append(key,part);
 const auth=getAuth(),context=await auth.$context;
 if(!await verifyOAuthQueryParams(query.toString(),context.secret))return <main className="auth-page"><h1>Connection request expired.</h1><p>Start the connection again from your assistant. No access has been granted.</p></main>;
 const h=await headers(),session=await auth.api.getSession({headers:h,query:{disableCookieCache:true}});
 if(!session)return <main className="auth-page"><h1>Sign in required.</h1><p>Restart the connection from your assistant and sign in to Career Desk.</p></main>;
 if(query.has('claims'))return <main className="auth-page"><h1>Additional identity claims are not supported.</h1><p>Reconnect requesting only the listed Career Desk permissions.</p></main>;
 const scopes=(query.get('scope')||'').split(' ').filter(Boolean);
 if(scopes.some(scope=>!pluginScopes.includes(scope)))return <main className="auth-page"><h1>Unsupported permission requested.</h1></main>;
 const clientId=query.get('client_id');if(!clientId)return <main className="auth-page"><h1>Invalid connection request.</h1></main>;
 const client=await auth.api.getOAuthClientPublic({headers:h,query:{client_id:clientId}});
 let requestedBy='';try{const url=new URL(clientId);if(url.protocol==='https:')requestedBy=url.hostname}catch{}
 return <Consent account={session.user.email} clientName={client.client_name||clientId} requestedBy={requestedBy} profileWrite={scopes.includes('career:profile:write')} permissions={scopes.map(scope=>scopeLabels[scope]||scope)}/>;
}
