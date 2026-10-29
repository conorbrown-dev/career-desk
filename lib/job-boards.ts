// Company job board watchlist: pure parsing and matching shared by the browser and the server.
// Network access and persistence live in board-sync.ts.
import {z} from 'zod';
import {locationMatches,parsePlaces} from './places';

export const providers=['greenhouse','lever','ashby'] as const;
export type Provider=typeof providers[number];
export const providerLabels:Record<Provider,string>={greenhouse:'Greenhouse',lever:'Lever',ashby:'Ashby'};
export const watchlistLimits={boards:40,seenPerBoard:3000,addsPerRun:40,addsPerBoard:15,newBoardsPerSave:20};

export const feeds=['remotive'] as const;
export type Feed=typeof feeds[number];
export type SourceStatus={lastCheckedAt?:string;lastOpen?:number;lastMatched?:number;lastAdded?:number;lastError?:string};
export type Board={provider:Provider;slug:string;name:string;addedAt:string}&SourceStatus;
export type Watchlist={boards:Board[];keywords:string;exclude:string;remoteOnly:boolean;places?:string;feeds?:Partial<Record<Feed,boolean>>;feedStatus?:Partial<Record<Feed,SourceStatus>>;seen:Record<string,string[]>;lastSyncAt?:string;lastSyncSource?:'manual'|'scheduled';lastSyncSummary?:string};
export type Posting={id:string;title:string;url:string;location:string;remote:boolean;company:string;salary?:string};
export const feedKey=(feed:Feed)=>'feed:'+feed;
export const hasSources=(w:Watchlist|null|undefined)=>!!w&&((w.boards?.length||0)>0||feeds.some(f=>w.feeds?.[f]));

const slugPattern=/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/;
const hosts:Record<string,Provider>={'job-boards.greenhouse.io':'greenhouse','boards.greenhouse.io':'greenhouse','jobs.lever.co':'lever','jobs.ashbyhq.com':'ashby'};
export const boardHelp='Paste a company’s Greenhouse, Lever, or Ashby careers link, such as https://jobs.lever.co/company or https://job-boards.greenhouse.io/company.';

/** Accepts a careers link (board or single posting) and returns the board it belongs to. */
export function parseBoardInput(input:string):{provider:Provider;slug:string}{
 const text=input.trim();
 let url:URL;
 try{url=new URL(/^https?:\/\//i.test(text)?text:'https://'+text)}catch{throw Error(boardHelp)}
 const provider=hosts[url.hostname.toLowerCase()];
 if(!provider)throw Error(boardHelp);
 let slug=decodeURIComponent(url.pathname.split('/').filter(Boolean)[0]||'');
 if(provider==='greenhouse'&&(!slug||slug==='embed'))slug=url.searchParams.get('for')||'';
 if(!slugPattern.test(slug))throw Error('That link doesn’t include a company board name. '+boardHelp);
 return {provider,slug};
}
export const boardKey=(b:{provider:Provider;slug:string})=>b.provider+':'+b.slug.toLowerCase();
export function boardApiUrl(b:{provider:Provider;slug:string}){
 const slug=encodeURIComponent(b.slug);
 if(b.provider==='greenhouse')return `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs`;
 if(b.provider==='lever')return `https://api.lever.co/v0/postings/${slug}?mode=json`;
 return `https://api.ashbyhq.com/posting-api/job-board/${slug}`;
}
export function boardPageUrl(b:{provider:Provider;slug:string}){
 const slug=encodeURIComponent(b.slug);
 return b.provider==='greenhouse'?`https://job-boards.greenhouse.io/${slug}`:b.provider==='lever'?`https://jobs.lever.co/${slug}`:`https://jobs.ashbyhq.com/${slug}`;
}
export function defaultBoardName(slug:string){return slug.replace(/[-_.]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).trim().slice(0,200)}

const str=(v:unknown)=>typeof v==='string'?v.trim():'';
const httpsUrl=(v:unknown)=>{const s=str(v);try{return new URL(s).protocol==='https:'?s:''}catch{return ''}};
const remoteText=(s:string)=>/\b(remote|anywhere|work from home|distributed)\b/i.test(s);

/** Converts a provider's public board response into postings; malformed entries are skipped. */
export function normalizeBoard(provider:Provider,data:any,fallbackCompany:string):Posting[]{
 const list:any[]=provider==='lever'?(Array.isArray(data)?data:[]):(Array.isArray(data?.jobs)?data.jobs:[]);
 const out:Posting[]=[];
 for(const j of list){
  if(!j||typeof j!=='object')continue;
  let p:Posting|null=null;
  if(provider==='greenhouse'){
   const location=str(j.location?.name);
   p={id:String(j.id??''),title:str(j.title),url:httpsUrl(j.absolute_url),location,remote:remoteText(location),company:str(j.company_name)||fallbackCompany};
  }else if(provider==='lever'){
   const location=str(j.categories?.location)||(Array.isArray(j.categories?.allLocations)?j.categories.allLocations.filter((x:any)=>typeof x==='string').join(' / '):'');
   const workplace=str(j.workplaceType).toLowerCase();
   p={id:str(j.id),title:str(j.text),url:httpsUrl(j.hostedUrl),location,remote:workplace==='remote'||((!workplace||workplace==='unspecified')&&remoteText(location)),company:fallbackCompany};
  }else{
   if(j.isListed===false)continue;
   const location=[str(j.location),...(Array.isArray(j.secondaryLocations)?j.secondaryLocations.map((x:any)=>str(x?.location)):[])].filter(Boolean).join(' / ');
   const workplace=str(j.workplaceType).toLowerCase();
   p={id:str(j.id),title:str(j.title),url:httpsUrl(j.jobUrl),location,remote:workplace==='remote'||(!workplace&&j.isRemote===true)||(!workplace&&remoteText(location)),company:fallbackCompany};
  }
  if(p.id&&p.title&&p.url)out.push({...p,title:p.title.slice(0,300),location:p.location.slice(0,1000),company:p.company.slice(0,200)});
 }
 return out;
}

const synonyms:Record<string,string>={sr:'senior',jr:'junior',mgr:'manager',dev:'developer',eng:'engineer',swe:'software engineer',pm:'product manager'};
const stop=new Set(['and','the','of','a','an','for','to','in','with','at','on']);
export function words(text:string){
 return text.toLowerCase().replace(/&/g,' and ').replace(/[^a-z0-9+#]+/g,' ').split(' ').filter(Boolean).flatMap(w=>(synonyms[w]||w).split(' ')).filter(w=>!stop.has(w));
}
/** Splits a free-text list ("Product Designer, UX Researcher or Design Lead") into phrases. */
export function phrases(text:string){
 return String(text||'').split(/[,;\n|]+|\s+or\s+/i).map(s=>s.trim()).filter(s=>words(s).length>0).slice(0,40);
}
const phraseIn=(title:Set<string>,phrase:string)=>{const w=words(phrase);return w.length>0&&w.every(x=>title.has(x))};

export type Criteria={roles:string;keywords:string;exclude:string;remoteOnly:boolean;places?:string};
/** A posting matches when its title contains every word of a target role or keyword phrase, and no excluded phrase.
 *  With work locations set, on-site and hybrid roles must be in one of them; remote roles and roles that list no
 *  location still pass, since the applicant can't be ruled out. */
export function matchPosting(p:Posting,c:Criteria):string|null{
 const title=new Set(words(p.title));
 if(phrases(c.exclude).some(x=>phraseIn(title,x)))return null;
 if(c.remoteOnly&&!p.remote)return null;
 if(!c.remoteOnly&&!p.remote&&p.location.trim()){const places=parsePlaces(c.places||'');if(places.length&&!locationMatches(p.location,places))return null;}
 return [...phrases(c.roles),...phrases(c.keywords)].find(x=>phraseIn(title,x))||null;
}

/** Remotive lists only remote roles; its candidate_required_location says where applicants may live. */
export function normalizeRemotive(data:any):Posting[]{
 const out:Posting[]=[];
 for(const j of Array.isArray(data?.jobs)?data.jobs:[]){
  if(!j||typeof j!=='object')continue;
  const p:Posting={id:String(j.id??''),title:str(j.title).slice(0,300),url:httpsUrl(j.url),location:str(j.candidate_required_location).slice(0,300),remote:true,company:str(j.company_name).slice(0,200),salary:str(j.salary).slice(0,200)||undefined};
  if(p.id&&p.title&&p.url&&p.company)out.push(p);
 }
 return out;
}
const usWide=/\b(usa|u\.s\.a?|united states|us|americas|north america|worldwide|anywhere|global)\b/i;
/** When the search is limited to US remote work, keep only remote postings open to US-based applicants (or that name no region). */
export function remoteRegionAllowed(location:string,profileRemote:string){
 if(!/\b(us|u\.s\.|usa|united states)\b/i.test(profileRemote))return true;
 return !location.trim()||usWide.test(location);
}

export function emptyWatchlist(profile:any):Watchlist{
 return {boards:[],keywords:'',exclude:'',places:'',remoteOnly:/\bremote\b/i.test(String(profile?.criteria?.remote||'')),feeds:{remotive:false},seen:{}};
}
export const watchlistSettingsSchema=z.object({
 boards:z.array(z.object({provider:z.enum(providers),slug:z.string().regex(slugPattern),name:z.string().trim().max(200).optional().default('')})).max(watchlistLimits.boards,`Watch up to ${watchlistLimits.boards} company boards`),
 keywords:z.string().max(2000).optional().default(''),
 exclude:z.string().max(2000).optional().default(''),
 places:z.string().max(2000).optional().default(''),
 remoteOnly:z.boolean(),
 feeds:z.object({remotive:z.boolean()}).strict().optional()
}).strict();
/** Applies edited settings while keeping each retained board's history and seen postings. */
export function applySettings(current:Watchlist,input:unknown,now=new Date()):{next:Watchlist;added:Board[]}{
 const s=watchlistSettingsSchema.parse(input);
 const old=new Map(current.boards.map(b=>[boardKey(b),b]));
 const boards:Board[]=[],added:Board[]=[],keys=new Set<string>();
 for(const b of s.boards){
  const key=boardKey(b);if(keys.has(key))continue;keys.add(key);
  const prev=old.get(key);
  const board:Board=prev?{...prev,name:b.name||prev.name}:{provider:b.provider,slug:b.slug,name:b.name||defaultBoardName(b.slug),addedAt:now.toISOString()};
  if(!prev)added.push(board);
  boards.push(board);
 }
 // Feed history is kept while a feed is off, so turning it back on doesn't re-add roles already reviewed.
 const seen=Object.fromEntries(Object.entries(current.seen||{}).filter(([k])=>keys.has(k)||k.startsWith('feed:')));
 return {next:{...current,boards,keywords:s.keywords,exclude:s.exclude,places:s.places,remoteOnly:s.remoteOnly,feeds:{...current.feeds,...s.feeds},seen},added};
}
/** The watchlist as shown to the browser, without the seen-posting bookkeeping. */
export function publicWatchlist(w:Watchlist|null){if(!w)return null;const {seen,...rest}=w;void seen;return rest}
