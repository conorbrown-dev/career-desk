'use client';
import {useState} from 'react';
import {authClient} from '@/lib/auth-client';
export default function RequestEmail({enabled,verification=false}:{enabled:boolean;verification?:boolean}){
 const [busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState('');
 return <main className="auth-page"><a className="brand" href="/">◎ careerdesk</a><section className="panel auth-card"><span className="eyebrow">ACCOUNT ACCESS</span><h1>{sent?'Check your email.':verification?'Verify your email.':'Reset your password.'}</h1>{!enabled?<p>Account email is being configured. Please try again later.</p>:sent?<p>If an account needs this email, a link is on its way. Check your inbox and spam folder. The link expires in 30 minutes.</p>:<><p>{verification?'Request a new email-verification link, then sign in after verifying.':'Enter your account email and we’ll send a one-time password-reset link.'}</p><form onSubmit={async e=>{
 e.preventDefault();setBusy(true);setError('');const email=String(new FormData(e.currentTarget).get('email'));
 try{const result=verification?await authClient.sendVerificationEmail({email,callbackURL:'/sign-in'}):await authClient.requestPasswordReset({email,redirectTo:'/reset-password'});if(result.error&&result.error.status>=500)setError('Account email is temporarily unavailable. Please try again later.');else if(result.error?.status===429)setError('Too many requests. Wait a minute, then try again.');else setSent(true)}catch{setError('Unable to connect. Please try again.')}finally{setBusy(false)}
 }}><label>Email<input name="email" type="email" autoComplete="email" required/></label>{error&&<p role="alert" className="error">{error}</p>}<button className="primary full" disabled={busy}>{busy?'Requesting…':verification?'Send verification link':'Send reset link'}</button></form></>}<a className="text-button" href="/sign-in">Return to sign in</a></section></main>
}
