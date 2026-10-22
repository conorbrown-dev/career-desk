import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {getAuth} from '@/lib/auth';
import {recoveryGrant} from '@/lib/recovery';
import ResetPassword from './reset-password';
export const dynamic='force-dynamic';
export default async function Page(){
 const session=await getAuth().api.getSession({headers:await headers(),query:{disableCookieCache:true}});
 if(!session)redirect('/sign-in');
 try{recoveryGrant(session.user.email)}catch{return <main className="auth-page"><section className="panel auth-card"><h1>Recovery window closed.</h1><p>This temporary recovery has expired or is not enabled for your account.</p><a href="/sign-in">Return to sign in</a></section></main>}
 return <ResetPassword/>;
}
