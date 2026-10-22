import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {getPool} from '../lib/db';
// Keep operator-visible setup activity when a hosted build log is unavailable.
const steps=[['migrations','scripts/migrate.ts'],['database checks','scripts/verify-db.ts'],['OAuth checks','scripts/verify-plugin.ts']];
for(const [label,file] of steps){
 const result=spawnSync(process.execPath,['--import','tsx',file],{encoding:'utf8',maxBuffer:2000000});
 process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
 if(result.status!==0){
  let detail=(result.stderr||result.stdout||'Setup process failed').slice(-5000);
  for(const value of Object.values(process.env))if(value&&value.length>=8)detail=detail.split(value).join('[redacted]');
  detail=detail.replace(/https?:\/\/[^\s'"<>]+/g,'[URL]').slice(-2500);
  const db=getPool();try{const owner=await db.query('SELECT id FROM "user" WHERE lower(email)=$1',[(process.env.CAREER_AUTOMATION_EMAIL||'').toLowerCase()]);if(owner.rows.length===1){const run={id:randomUUID(),at:new Date().toISOString(),status:'Setup failed',added:0,sources:[],summary:'ChatGPT connection deployment failed during '+label+'. This was a setup check, not a job search. Diagnostic: '+detail};await db.query('INSERT INTO career_runs(owner_id,id,payload) VALUES($1,$2,$3)',[owner.rows[0].id,run.id,JSON.stringify(run)])}}finally{await db.end()}
  process.exit(1);
 }
}
console.log('Deployment database and OAuth checks passed.');
