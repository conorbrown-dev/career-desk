import {resolve4} from 'node:dns/promises';
import {request} from 'node:https';
import {isIP} from 'node:net';
export function publicIPv4(ip:string){const p=ip.split('.').map(Number);if(p.length!==4||p.some(n=>!Number.isInteger(n)||n<0||n>255))return false;const [a,b,c]=p;return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||(b===88&&c===99)))||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113))}
export function postingUrl(input:string){const url=new URL(input);if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||isIP(url.hostname)||url.hostname.includes(':')||!url.hostname.includes('.')||url.hostname.endsWith('.localhost')||url.hostname.endsWith('.local'))throw Error('Use a public HTTPS job posting link without credentials.');url.hash='';return url}
export async function fetchPosting(input:string){let url=postingUrl(input);const deadline=Date.now()+12000;for(let redirects=0;redirects<=3;redirects++){
 const addresses=await Promise.race([resolve4(url.hostname),new Promise<never>((_,reject)=>{const timer=setTimeout(()=>reject(Error('Posting lookup timed out. Try pasting the posting text.')),3000);timer.unref()})]);
 if(!addresses.length||addresses.some(ip=>!publicIPv4(ip)))throw Error('This link does not resolve to a public posting site.');
 const result=await new Promise<{html:string;location?:string}>((resolve,reject)=>{
  const remaining=deadline-Date.now();if(remaining<=0){reject(Error('Import timed out. Try pasting the posting text.'));return}
  const req=request(url,{method:'GET',family:4,lookup:(_host,_options,callback)=>callback(null,addresses[0],4),headers:{Accept:'text/html, application/ld+json','Accept-Encoding':'identity','User-Agent':'CareerDesk/1.0 (job posting preview)'}},res=>{
   if([301,302,303,307,308].includes(res.statusCode||0)){res.destroy();resolve({html:'',location:res.headers.location});return}
   if(res.statusCode!==200){res.destroy();reject(Error('This site could not be imported. Paste the posting text below instead.'));return}
   const type=String(res.headers['content-type']||'');if(!/text\/html|application\/(?:ld\+)?json|application\/xhtml\+xml/i.test(type)){res.destroy();reject(Error('This link is not a readable job posting.'));return}
   let size=0;const chunks:Buffer[]=[];res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>1500000){req.destroy(Error('Posting is too large. Paste the relevant posting text instead.'));return}chunks.push(chunk)});res.on('end',()=>resolve({html:Buffer.concat(chunks).toString('utf8')}));res.on('error',reject);
  });const timer=setTimeout(()=>req.destroy(Error('Import timed out. Paste the posting text instead.')),remaining);req.on('close',()=>clearTimeout(timer));req.on('error',reject);req.end();
 });if(result.location){url=postingUrl(new URL(result.location,url).href);continue}if(!result.html)throw Error('The posting redirected without a readable destination.');return {html:result.html,url:url.href};
 }throw Error('Too many redirects. Use the employer’s direct posting link or paste its text.');}
function decode(text:string){return text.replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):''}).replace(/&(amp|quot|apos|lt|gt|nbsp|ndash|mdash);/gi,(_,n)=>(({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',ndash:'–',mdash:'—'} as Record<string,string>)[n.toLowerCase()]||''))}
export function plain(text:unknown){return decode(String(text||'').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<\/(?:p|div|li|h[1-6])>|<br\s*\/?>/gi,'\n').replace(/<[^>]*>/g,' ')).replace(/[ \t]+/g,' ').replace(/\n\s*\n/g,'\n').trim()}
function findJob(value:any,depth=0):any{if(depth>12||!value||typeof value!=='object')return null;if([value['@type']].flat().some(t=>typeof t==='string'&&/(^|[\/#])JobPosting$/.test(t)))return value;for(const child of Object.values(value)){if(child&&typeof child==='object'){const found=findJob(child,depth+1);if(found)return found}}return null}
export function parsePosting(content:string,url:string,pasted=false){
 let job:any=null;if(!pasted&&/^[\s]*[\[{]/.test(content)){try{job=findJob(JSON.parse(content))}catch{}}if(!pasted&&!job)for(const script of content.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){try{job=findJob(JSON.parse(script[1]));if(job)break}catch{}}
 const description=plain(job?.description||content).slice(0,30000);
 const fallbackTitle=pasted?content.match(/^(?:Job title|Role title|Title):\s*(.+)$/im)?.[1]:(content.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||content.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
 const title=plain(job?.title||fallbackTitle).slice(0,300);
 const company=plain(job?.hiringOrganization?.name||(pasted?content.match(/^(?:Company|Employer):\s*(.+)$/im)?.[1]:'')).slice(0,200);
 const locations=[job?.jobLocation].flat().filter(Boolean).map((loc:any)=>{const a=loc.address||{};return [a.addressLocality,a.addressRegion,typeof a.addressCountry==='object'?a.addressCountry.name:a.addressCountry].filter(v=>typeof v==='string').join(', ')}).filter(Boolean);
 if(job?.jobLocationType==='TELECOMMUTE')locations.unshift('Remote');
 const salary=job?.baseSalary,value=salary?.value;const annual=salary?.currency==='USD'&&value?.unitText?.toUpperCase()==='YEAR';
 const min=annual?Number(value.minValue??value.value):NaN,max=annual?Number(value.maxValue??value.value):NaN;
 const warnings:string[]=['Review the posting before saving. Remote eligibility, degree requirements, and personal fit need your review.'];
 if(!job)warnings.push(pasted?'Posting text was copied into the description. Review the company, role, and any missing fields.':'No structured job details were found. The title and page text are a draft; paste the posting text if the page contains menus or unrelated content.');
 if(!company)warnings.push('Company needs to be added.');if(!title)warnings.push('Role title needs to be added.');if(!annual)warnings.push('Annual USD base salary was not identified; compensation fields are left blank.');
 return {opportunity:{company,title,url,stage:'Discovered',location:locations.join(' · ').slice(0,1000),remote:'Needs verification',degree:'Needs verification',minBase:Number.isFinite(min)&&min>=0?min:null,maxBase:Number.isFinite(max)&&max>=0?max:null,description,source:`Imported ${pasted?'from pasted posting text':'from posting'}: ${url}\n${new Date().toISOString()}`,nextAction:'Review imported details, verify eligibility and compensation, and compare the posting with your experience.'},warnings};
}
