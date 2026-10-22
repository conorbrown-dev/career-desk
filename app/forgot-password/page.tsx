import {emailReady} from '@/lib/account-email';
import RequestEmail from './request-email';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default function Page(){return <RequestEmail enabled={emailReady()}/>}
