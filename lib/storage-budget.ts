import type {Database} from './repository';
const defaultBudget=100*1024*1024;
export function documentBudget(){
 const raw=process.env.TOTAL_DOCUMENT_BYTES;
 if(raw===undefined||raw==='')return defaultBudget;
 const value=Number(raw);
 if(!Number.isSafeInteger(value)||value<0)throw Error('Total document storage limit is invalid');
 return value;
}
/** Call within the write transaction. Uploads and restores share one budget lock. */
export async function reserveDocumentBudget(db:Database,additionalBytes:number){
 if(!Number.isSafeInteger(additionalBytes)||additionalBytes<0)throw Error('Invalid document size');
 await db.query('SELECT pg_advisory_xact_lock(hashtext($1))',['career-desk:global-document-budget']);
 const result=await db.query('SELECT COALESCE(SUM(size_bytes),0)::bigint AS bytes FROM career_documents');
 if(Number(result.rows[0].bytes)+additionalBytes>documentBudget())throw Error('Service document storage is full. Existing documents remain available; try again after the operator frees capacity.');
}
