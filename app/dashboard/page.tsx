import {headers} from 'next/headers';
import {redirect} from 'next/navigation';
import {configured} from '@/lib/config';
import {getAuth} from '@/lib/auth';
import Workspace from './workspace';
export const dynamic='force-dynamic';
export default async function Page(){if(!configured())redirect('/sign-in');const session=await getAuth().api.getSession({headers:await headers()});if(!session)redirect('/sign-in');return <Workspace/>}
