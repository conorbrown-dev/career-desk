import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildEnvelope,parseDsn,redact,shouldReport} from '../lib/error-report';

test('DSN parsing accepts only HTTPS Sentry DSNs with a numeric project',()=>{
 const t=parseDsn('https://abc123@o1.ingest.us.sentry.io/4507');
 assert.equal(t?.endpoint,'https://o1.ingest.us.sentry.io/api/4507/envelope/?sentry_key=abc123&sentry_version=7');
 for(const dsn of [undefined,'','not a url','http://abc@o1.ingest.sentry.io/1','https://o1.ingest.sentry.io/1','https://abc@o1.ingest.sentry.io/project'])assert.equal(parseDsn(dsn),null,String(dsn));
});

test('only crashes and infrastructure faults are reported',()=>{
 const pg=(code:string,message='db')=>Object.assign(new Error(message),{code});
 for(const e of [new TypeError('x is undefined'),new ReferenceError('y'),pg('57P01'),pg('08006'),pg('53300'),Object.assign(new Error('connect'),{code:'ECONNREFUSED'}),new Error('Connection terminated unexpectedly'),new Error('timeout exceeded when trying to connect')])assert.equal(shouldReport(e),true,e.message);
 for(const e of [new Error('Profile is too large'),new Error('Please wait a minute before importing another posting.'),new Error('This connection is no longer authorized'),new SyntaxError('Unexpected token'),Object.assign(new TypeError('Invalid URL'),{code:'ERR_INVALID_URL'}),pg('23505'),pg('22P02'),'string error',null])assert.equal(shouldReport(e),false,String((e as any)?.message??e));
});

test('redaction removes secrets, emails, tokens and query strings',()=>{
 const out=redact('failed for jane.doe@example.com using secretvalue123 Bearer abc.def at https://x.example/p?token=1 id 0123456789abcdef0123456789abcdef01',{SECRET:'secretvalue123'});
 assert.doesNotMatch(out,/jane\.doe|secretvalue123|abc\.def|token=1|0123456789abcdef0123456789abcdef01/);
 assert.match(out,/\[email\]/);assert.match(out,/https:\/\/x\.example\/p/);
 assert.ok(redact('x'.repeat(5000)).length<=1000);
});

test('envelope carries only error type, redacted message, frames and path',()=>{
 const error=new TypeError('cannot read owner of user@example.com');
 const lines=buildEnvelope(error,{route:'/api/jobs?id=secret',method:'POST',source:'api'},'https://k@o.ingest.sentry.io/1',{VERCEL_ENV:'production',VERCEL_GIT_COMMIT_SHA:'abcdef1234567890'}).trim().split('\n');
 assert.equal(lines.length,3);
 const event=JSON.parse(lines[2]);
 assert.equal(event.environment,'production');assert.equal(event.release,'abcdef123456');
 assert.equal(event.tags.route,'/api/jobs');assert.equal(event.exception.values[0].type,'TypeError');
 assert.match(event.exception.values[0].value,/\[email\]/);
 assert.ok(Array.isArray(event.exception.values[0].stacktrace.frames));
 for(const key of ['request','user','contexts','extra','breadcrumbs'])assert.equal(event[key],undefined,key);
});
