import {Resend} from 'resend';

type AccountMessage={to:string;kind:'verification'|'reset'|'deletion';url:string};
export function emailReady(){return process.env.EMAIL_DELIVERY_ENABLED==='true'&&Boolean(process.env.RESEND_API_KEY&&process.env.RESEND_EMAIL_DOMAIN)}
export function resetLink(base:string,token:string){const url=new URL('/reset-password',base);url.hash=new URLSearchParams({token}).toString();return url.toString()}
export async function sendAccountEmail({to,kind,url}:AccountMessage){
 if(!emailReady())throw Error('Account email is not configured');
 const domain=process.env.RESEND_EMAIL_DOMAIN!;
 if(!/^[a-z0-9.-]+$/i.test(domain))throw Error('Invalid sender domain');
 const action=kind==='deletion'?'Permanently delete your Career Desk account':kind==='reset'?'Reset your password':'Verify your email';
 const {error}=await new Resend(process.env.RESEND_API_KEY).emails.send({from:`Career Desk <accounts@${domain}>`,to:[to],subject:`${action} — Career Desk`,text:`${action}\n\n${url}\n\nThis link expires in 30 minutes. If you did not request it, you can ignore this email.\n\nCareer Desk`});
 // Never log provider errors: they can contain recipient data or authentication links.
 if(error)throw Error('Account email delivery failed');
}
export function accountEmailOptions(send:(message:AccountMessage)=>Promise<void>,base:string){return {
 emailAndPassword:{enabled:true,minPasswordLength:12,maxPasswordLength:128,requireEmailVerification:true,revokeSessionsOnPasswordReset:true,resetPasswordTokenExpiresIn:1800,sendResetPassword:async({user,token}:{user:{email:string};token:string})=>send({to:user.email,kind:'reset',url:resetLink(base,token)})},
 emailVerification:{sendOnSignUp:true,sendOnSignIn:false,autoSignInAfterVerification:false,expiresIn:1800,sendVerificationEmail:async({user,url}:{user:{email:string};url:string})=>send({to:user.email,kind:'verification',url})}
}}
