import {randomUUID} from 'node:crypto';

// Dependency-free Sentry reporting. Sends only the error type, a redacted message, code frames and the route path:
// never request bodies, headers, cookies, query strings, profiles, documents or account identifiers.
// Does nothing unless SENTRY_DSN is set.

export function parseDsn(dsn:string|undefined){
 if(!dsn)return null;
 try{
  const url=new URL(dsn);const project=url.pathname.replace(/^\/+|\/+$/g,'');
  if(url.protocol!=='https:'||!url.username||!/^\d+$/.test(project))return null;
  return {key:url.username,endpoint:`${url.origin}/api/${project}/envelope/?sentry_key=${encodeURIComponent(url.username)}&sentry_version=7`,dsn};
 }catch{return null}
}

export function redact(text:string,env:Record<string,string|undefined>=process.env){
 let out=String(text||'');
 for(const value of Object.values(env))if(value&&value.length>=8)out=out.split(value).join('[redacted]');
 return out
  .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,'[email]')
  .replace(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi,'$1 [redacted]')
  .replace(/(https?:\/\/[^\s'"<>?#]+)[?#][^\s'"<>]*/g,'$1')
  .replace(/\b[A-Za-z0-9_-]{32,}\b/g,'[token]')
  .slice(0,1000);
}

// Report crashes and infrastructure faults, not the expected validation messages users see.
export function shouldReport(error:unknown){
 if(!(error instanceof Error))return false;
 const code=(error as {code?:unknown}).code;
 // Malformed JSON bodies (SyntaxError) and invalid user-entered URLs (ERR_INVALID_URL) are bad input, not crashes.
 if(error.name==='SyntaxError'||(typeof code==='string'&&code.startsWith('ERR_INVALID')))return false;
 if(['TypeError','ReferenceError','RangeError','EvalError','URIError'].includes(error.name))return true;
 // PostgreSQL SQLSTATE (except data exceptions 22 and constraint violations 23, which user input can cause) or Node system error
 if(typeof code==='string'&&((/^[0-9A-Z]{5}$/.test(code)&&!/^2[23]/.test(code))||/^E[A-Z]{3,}$/.test(code)))return true;
 // pg pool failures arrive as plain Errors; app messages such as "This connection is no longer authorized" must not match.
 return /Connection terminated|timeout exceeded when trying to connect|ECONNRESET|ECONNREFUSED|Database is not configured/i.test(error.message);
}

function frames(stack:string|undefined){
 const out:{function?:string;filename:string;lineno?:number;colno?:number;in_app:boolean}[]=[];
 for(const line of String(stack||'').split('\n').slice(1,40)){
  const m=line.match(/^\s*at (?:(.+?) \()?(.+?):(\d+):(\d+)\)?$/);if(!m)continue;
  const filename=m[2].replace(/^file:\/\//,'').replace(/^.*\/(\.next|node_modules)\//,'$1/');
  out.push({function:m[1]||undefined,filename,lineno:Number(m[3]),colno:Number(m[4]),in_app:!filename.startsWith('node_modules/')&&!filename.startsWith('node:')});
 }
 return out.reverse();
}

export function buildEnvelope(error:Error,context:{route?:string;method?:string;source:string},dsn:string,env:Record<string,string|undefined>=process.env){
 const eventId=randomUUID().replace(/-/g,'');
 const route=context.route?String(context.route).split(/[?#]/)[0].slice(0,200):undefined;
 const event={event_id:eventId,timestamp:Date.now()/1000,platform:'node',level:'error',environment:env.VERCEL_ENV||'development',release:env.VERCEL_GIT_COMMIT_SHA?.slice(0,12),server_name:'career-desk',tags:{source:context.source,...(route?{route}:{}),...(context.method?{method:context.method}:{})},exception:{values:[{type:error.name||'Error',value:redact(error.message,env),stacktrace:{frames:frames(error.stack)}}]}};
 return `${JSON.stringify({event_id:eventId,sent_at:new Date().toISOString(),dsn})}\n${JSON.stringify({type:'event'})}\n${JSON.stringify(event)}\n`;
}

export async function reportError(error:unknown,context:{route?:string;method?:string;source:string}){
 const target=parseDsn(process.env.SENTRY_DSN);if(!target||!(error instanceof Error))return;
 try{await fetch(target.endpoint,{method:'POST',headers:{'Content-Type':'application/x-sentry-envelope'},body:buildEnvelope(error,context,target.dsn),signal:AbortSignal.timeout(2500)})}catch{/* Reporting must never break the request. */}
}
