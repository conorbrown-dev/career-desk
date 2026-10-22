import SignIn from './sign-in';
import {configured} from '@/lib/config';
export default function Page(){return <SignIn ready={configured()} allowSignup={process.env.ALLOW_SIGNUP==='true'}/>}
