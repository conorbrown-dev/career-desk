import {z} from 'zod';
import {identity,sameOrigin,failure,json} from '@/lib/http';
import {repository} from '@/lib/service';
import {fetchPosting,parsePosting,postingUrl} from '@/lib/import-opportunity';
export async function POST(r:Request){try{sameOrigin(r);const u=await identity(r);const raw=await r.text();if(raw.length>80000)throw Error('Posting text is too large.');const input=z.object({url:z.string().max(2000),postingText:z.string().max(60000).optional()}).strict().parse(JSON.parse(raw));const url=postingUrl(input.url).href;await repository().reserveImport(u.id);if(input.postingText?.trim())return json(parsePosting(input.postingText,url,true));const page=await fetchPosting(url);return json(parsePosting(page.html,page.url));}catch(e){return failure(e)}}
