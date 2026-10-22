import {headers} from 'next/headers';
import {getAuth} from '@/lib/auth';
import {recoveryGrant} from '@/lib/recovery';
import ResetPassword from './reset-password';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default async function Page(){
 const session=await getAuth().api.getSession({headers:await headers(),query:{disableCookieCache:true}});
 let sessionRecoveryAvailable=false;
 if(session)try{recoveryGrant(session.user.email);sessionRecoveryAvailable=true}catch{}
 return <ResetPassword sessionRecoveryAvailable={sessionRecoveryAvailable}/>;
}
