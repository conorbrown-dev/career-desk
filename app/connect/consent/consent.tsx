'use client';
import {useState} from 'react';
import {authClient} from '@/lib/auth-client';
export default function Consent({account,clientName,permissions}:{account:string;clientName:string;permissions:string[]}){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function choose(accept:boolean){setBusy(true);setError('');try{const r=await authClient.oauth2.consent({accept});if(r.error)throw Error(r.error.message||'Unable to finish connection');if(r.data?.url)window.location.assign(r.data.url);else throw Error('Connection did not return a destination. Restart from ChatGPT.')}catch(e){setError(e instanceof Error?e.message:'Unable to finish connection');setBusy(false)}}
 return <main className="auth-page"><a className="brand" href="/">◎ careerdesk</a><section className="panel auth-card"><span className="eyebrow">CONNECT YOUR WORKSPACE</span><h1>Allow {clientName}?</h1><p>You are connecting <strong>{account}</strong>. Only this Career Desk account will be accessible.</p><ul>{permissions.map(permission=><li key={permission}>{permission}</li>)}</ul><p>This connection cannot submit job applications, send messages, change your profile, or modify submitted or interview-stage applications. AI work runs in your assistant account, subject to its own limits.</p>{error&&<p role="alert" className="error">{error}</p>}<div className="actions"><button className="primary" disabled={busy} onClick={()=>choose(true)}>Allow connection</button><button className="secondary" disabled={busy} onClick={()=>choose(false)}>Cancel</button></div></section></main>;
}
