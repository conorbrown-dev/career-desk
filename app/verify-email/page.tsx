import {emailReady} from '@/lib/account-email';
import RequestEmail from '../forgot-password/request-email';
export const dynamic='force-dynamic';
export const metadata={robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default function Page(){return <RequestEmail verification enabled={emailReady()}/>}
