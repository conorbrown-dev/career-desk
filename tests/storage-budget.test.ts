import {test} from 'node:test';
import assert from 'node:assert/strict';
import {documentBudget,reserveDocumentBudget} from '../lib/storage-budget';
test('global PDF budget serializes writers, accepts the boundary and rejects overflow',async()=>{
 const saved=process.env.TOTAL_DOCUMENT_BYTES;process.env.TOTAL_DOCUMENT_BYTES='100';
 try{const calls:string[]=[];const db={async query(sql:string){calls.push(sql);return {rows:[{bytes:'90'}]}}};
 await reserveDocumentBudget(db,10);assert.match(calls[0],/pg_advisory_xact_lock/);assert.match(calls[1],/SUM/);
 await assert.rejects(()=>reserveDocumentBudget(db,11),/storage is full/);
 process.env.TOTAL_DOCUMENT_BYTES='0';await assert.rejects(()=>reserveDocumentBudget(db,1),/storage is full/);
 process.env.TOTAL_DOCUMENT_BYTES='invalid';assert.throws(documentBudget,/invalid/);
 }finally{if(saved===undefined)delete process.env.TOTAL_DOCUMENT_BYTES;else process.env.TOTAL_DOCUMENT_BYTES=saved;}
});
