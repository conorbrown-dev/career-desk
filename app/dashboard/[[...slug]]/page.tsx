import {Suspense} from 'react';
import {headers} from 'next/headers';
import {notFound,redirect} from 'next/navigation';
import {configured} from '@/lib/config';
import {getAuth} from '@/lib/auth';
import Workspace from '../workspace';
import {parseSegments} from '../routes';
export const dynamic='force-dynamic';
// One page for every workspace URL (/dashboard, /dashboard/opportunities, …); the workspace reads the path to pick its view.
export default async function Page({params}:{params:Promise<{slug?:string[]}>}){
 if(!parseSegments((await params).slug))notFound();
 if(!configured())redirect('/sign-in');
 const session=await getAuth().api.getSession({headers:await headers()});
 if(!session)redirect('/sign-in');
 return <Suspense><Workspace/></Suspense>;
}
