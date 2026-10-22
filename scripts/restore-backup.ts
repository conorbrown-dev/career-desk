import {readFile} from 'node:fs/promises';
import {getPool} from '../lib/db';
import {restoreBackup} from '../lib/backup';
const [email,path]=process.argv.slice(2);if(!email||!path)throw Error('Usage: restore-backup.ts VERIFIED_ACCOUNT_EMAIL PRIVATE_BACKUP_PATH');
const db=getPool();try{const owner=await db.query('SELECT id FROM "user" WHERE lower(email)=$1',[email.toLowerCase()]);if(owner.rows.length!==1)throw Error('Verified destination account not found');const input=JSON.parse(await readFile(path,'utf8'));const result=await restoreBackup(db,owner.rows[0].id,input);console.log('Backup restored:',result.applications,'applications,',result.documents,'PDFs.')}finally{await db.end()}
