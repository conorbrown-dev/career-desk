import {symmetricDecrypt} from 'better-auth/crypto';
import {getAuth} from '../lib/auth';
import {getPool} from '../lib/db';
// One-time repair for disposable verification keys created before the fixture
// key adapter was isolated. Retire only unreadable keys in the exact test window.
// Expiry is reversible; healthy production keys are never changed.
const db=getPool(),context=await getAuth().$context;
try{
 const keys=await db.query('SELECT id,"privateKey" FROM jwks WHERE "createdAt">=$1 AND "createdAt"<=$2 AND ("expiresAt" IS NULL OR "expiresAt">NOW())',['2026-10-22T11:14:00Z','2026-10-22T11:24:30Z']);
 let count=0;for(const key of keys.rows){try{await symmetricDecrypt({key:context.secretConfig,data:JSON.parse(key.privateKey)})}catch{await db.query('UPDATE jwks SET "expiresAt"=$2 WHERE id=$1',[key.id,new Date(0)]);count++}}
 const signed=await getAuth().api.signJWT({body:{payload:{purpose:'deployment-key-health-check'}}});
 const verified=await getAuth().api.verifyJWT({body:{token:signed.token}});if(!verified.payload||verified.payload.purpose!=='deployment-key-health-check')throw Error('Production signing key verification failed');
 console.log('Retired '+count+' unusable disposable verification key(s); healthy keys preserved.');
}finally{await db.end()}
