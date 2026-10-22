import {spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {getPool} from '../lib/db';
import {recordDiagnostic} from '../lib/deployment-diagnostics';
// Record failures in operator-only diagnostics (never the workspace activity feed) in case a hosted build log is unavailable.
const steps=[['migrations','scripts/migrate.ts'],['database checks','scripts/verify-db.ts'],['OAuth checks','scripts/verify-plugin.ts'],['account email checks','scripts/verify-account-email.ts'],['account deletion checks','scripts/verify-lifecycle.ts']];
for(const [label,file] of steps){
 const result=spawnSync(process.execPath,['--import','tsx',file],{encoding:'utf8',maxBuffer:2000000});
 process.stdout.write(result.stdout||'');process.stderr.write(result.stderr||'');
 if(result.status!==0){
  let detail=(result.stderr||result.stdout||'Setup process failed').slice(-5000);
  for(const value of Object.values(process.env))if(value&&value.length>=8)detail=detail.split(value).join('[redacted]');
  detail=detail.replace(/https?:\/\/[^\s'"<>]+/g,'[URL]').slice(-2500);
  const db=getPool();try{await recordDiagnostic(db,randomUUID(),label,'Deployment setup failed during '+label+'. Diagnostic: '+detail)}catch{/* The build log still carries the failure. */}finally{await db.end()}
  process.exit(1);
 }
}
console.log('Deployment database and OAuth checks passed.');
