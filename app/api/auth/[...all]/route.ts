import {getAuth} from '@/lib/auth';
import {configured} from '@/lib/config';
import {toNextJsHandler} from 'better-auth/next-js';
export async function GET(r:Request){if(!configured())return Response.json({error:'Account setup is not complete'},{status:503});return toNextJsHandler(getAuth()).GET(r)}
export async function POST(r:Request){if(!configured())return Response.json({error:'Account setup is not complete'},{status:503});return toNextJsHandler(getAuth()).POST(r)}
