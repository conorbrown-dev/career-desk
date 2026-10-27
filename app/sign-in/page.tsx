import {Suspense} from 'react';
import SignIn from './sign-in';
import {emailReady} from '@/lib/account-email';
import {configured} from '@/lib/config';
export default function Page(){return <Suspense><SignIn emailEnabled={emailReady()} ready={configured()} allowSignup={process.env.ALLOW_SIGNUP==='true'}/></Suspense>}
