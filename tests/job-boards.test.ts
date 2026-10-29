import {test} from 'node:test';
import assert from 'node:assert/strict';
import {applySettings,boardApiUrl,emptyWatchlist,matchPosting,normalizeBoard,parseBoardInput,phrases,publicWatchlist,type Watchlist} from '../lib/job-boards';
import {authorizeCron,syncWatchlist} from '../lib/board-sync';
import {canonicalUrl} from '../lib/config';

test('careers links resolve to a provider board, including single-posting and embed links',()=>{
 assert.deepEqual(parseBoardInput('https://jobs.lever.co/acme'),{provider:'lever',slug:'acme'});
 assert.deepEqual(parseBoardInput('jobs.lever.co/acme/6ed76ce8-4156-4b60-b120-403538bd66cd'),{provider:'lever',slug:'acme'});
 assert.deepEqual(parseBoardInput('https://job-boards.greenhouse.io/vercel/jobs/123456'),{provider:'greenhouse',slug:'vercel'});
 assert.deepEqual(parseBoardInput('https://boards.greenhouse.io/embed/job_app?for=figma&token=1'),{provider:'greenhouse',slug:'figma'});
 assert.deepEqual(parseBoardInput('https://jobs.ashbyhq.com/ramp'),{provider:'ashby',slug:'ramp'});
 assert.throws(()=>parseBoardInput('https://careers.example.com/jobs'),/Greenhouse, Lever, or Ashby/);
 assert.throws(()=>parseBoardInput('https://jobs.lever.co/'),/board name/);
 assert.equal(boardApiUrl({provider:'greenhouse',slug:'vercel'}),'https://boards-api.greenhouse.io/v1/boards/vercel/jobs');
});

test('board responses normalize to postings and detect remote roles conservatively',()=>{
 const gh=normalizeBoard('greenhouse',{jobs:[{id:1,title:'Software Engineer',absolute_url:'https://job-boards.greenhouse.io/v/jobs/1',location:{name:'Remote - US'},company_name:'Vercel'},{id:2,title:'No link'}]},'Fallback');
 assert.equal(gh.length,1);assert.equal(gh[0].company,'Vercel');assert.equal(gh[0].remote,true);
 const lever=normalizeBoard('lever',[{id:'a',text:'Designer',hostedUrl:'https://jobs.lever.co/x/a',categories:{location:'London'},workplaceType:'hybrid'},{id:'b',text:'Engineer',hostedUrl:'https://jobs.lever.co/x/b',categories:{location:'Anywhere'},workplaceType:'remote'}],'X');
 assert.deepEqual(lever.map(p=>[p.id,p.remote,p.company]),[['a',false,'X'],['b',true,'X']]);
 const ashby=normalizeBoard('ashby',{jobs:[{id:'r',title:'Analyst',jobUrl:'https://jobs.ashbyhq.com/r/1',location:'New York',isRemote:true,workplaceType:'Hybrid',isListed:true},{id:'h',title:'Hidden',jobUrl:'https://jobs.ashbyhq.com/r/2',isListed:false},{id:'w',title:'Writer',jobUrl:'http://insecure.example/2',isListed:true}]},'Ramp');
 assert.deepEqual(ashby.map(p=>[p.id,p.remote]),[['r',false]],'Hybrid is not remote; unlisted and non-HTTPS postings are skipped');
 assert.deepEqual(normalizeBoard('lever',{jobs:[]},'X'),[]);
});

test('titles match whole target-role phrases, honor exclusions and the remote filter',()=>{
 const p=(title:string,remote=true)=>({id:title,title,url:'https://x.test/'+title,location:'',remote,company:'X'});
 const c={roles:'Software Engineer, Senior Product Designer or Data Analyst',keywords:'',exclude:'intern',remoteOnly:false};
 assert.deepEqual(phrases(c.roles),['Software Engineer','Senior Product Designer','Data Analyst']);
 assert.equal(matchPosting(p('Senior Software Engineer, Backend'),c),'Software Engineer');
 assert.equal(matchPosting(p('Sr. Product Designer'),c),'Senior Product Designer');
 assert.equal(matchPosting(p('Staff Product Designer'),c),null);
 assert.equal(matchPosting(p('Software Engineer Intern'),c),null);
 assert.equal(matchPosting(p('Data Analyst',false),{...c,remoteOnly:true}),null);
 assert.equal(matchPosting(p('Developer Advocate'),{...c,keywords:'developer advocate'}),'developer advocate');
 assert.equal(matchPosting(p('Software Engineer'),{...c,roles:''}),null);
});

test('settings keep history for retained boards, drop removed ones, and dedupe',()=>{
 const current:Watchlist={...emptyWatchlist({criteria:{remote:'Remote (US)'}}),boards:[{provider:'lever',slug:'acme',name:'Acme',addedAt:'2026-01-01T00:00:00.000Z',lastOpen:4}],seen:{'lever:acme':['1'],'ashby:gone':['2']}};
 assert.equal(current.remoteOnly,true);
 const {next,added}=applySettings(current,{boards:[{provider:'lever',slug:'ACME',name:''},{provider:'ashby',slug:'ramp',name:'Ramp'},{provider:'ashby',slug:'ramp',name:'Dup'}],keywords:'',exclude:'',remoteOnly:false});
 assert.deepEqual(next.boards.map(b=>[b.slug,b.name,b.lastOpen]),[['acme','Acme',4],['ramp','Ramp',undefined]]);
 assert.deepEqual(added.map(b=>b.slug),['ramp']);
 assert.deepEqual(next.seen,{'lever:acme':['1']});
 assert.equal('seen' in publicWatchlist(next)!,false);
 assert.throws(()=>applySettings(current,{boards:Array.from({length:41},(_,i)=>({provider:'lever',slug:'c'+i})),remoteOnly:false}),/up to 40/);
 assert.throws(()=>applySettings(current,{boards:[],remoteOnly:false,extra:true}));
});

function fakeRepo(watch:Watchlist,roles='Software Engineer',limit=250){
 const state={watch:structuredClone(watch),jobs:[] as any[],runs:[] as any[]};
 const repo:any={
  watchlist:async()=>structuredClone(state.watch),
  updateWatchlist:async(_o:string,change:(w:any)=>any)=>{const n=change(structuredClone(state.watch));if(n!==null)state.watch=n;return state.watch},
  profile:async()=>({criteria:{roles,remote:'US remote only'}}),
  jobs:async()=>state.jobs,
  save:async(_o:string,job:any,preparationOnly:boolean)=>{
   assert.equal(preparationOnly,true);assert.equal(job.stage,'Discovered');
   const url=canonicalUrl(job.url);
   if(state.jobs.some(j=>j.url===url))throw Error('This posting is already in your pipeline');
   if(state.jobs.length>=limit)throw Error('Pilot application limit reached. Export and archive older work.');
   const value={...job,url,id:'job-'+state.jobs.length};state.jobs.push(value);return value;
  },
  recordRun:async(_o:string,run:any)=>{state.runs.push(run);return run}
 };
 return {repo,state};
}
const board=(slug:string,provider:'lever'|'greenhouse'='lever')=>({provider,slug,name:slug.toUpperCase(),addedAt:'2026-10-01T00:00:00.000Z'});
const leverJobs=(slug:string,titles:string[])=>titles.map((t,i)=>({id:slug+i,text:t,hostedUrl:`https://jobs.lever.co/${slug}/${i}`,categories:{location:'Remote'},workplaceType:'remote'}));

test('a board check adds new matches once, skips non-matches and existing jobs, and records an honest run',async()=>{
 const {repo,state}=fakeRepo({...emptyWatchlist({}),boards:[board('acme'),board('broken','greenhouse')]});
 state.jobs.push({id:'existing',url:canonicalUrl('https://jobs.lever.co/acme/2')});
 const fetchJson=async(url:string)=>{if(url.includes('greenhouse'))throw Error('404');return leverJobs('acme',['Software Engineer','Account Executive','Senior Software Engineer'])};
 const first=await syncWatchlist(repo,'owner','manual',{fetchJson});
 assert.equal(first.added,1,'Only the unseen match not already in the pipeline is added');
 assert.equal(state.jobs.at(-1).company,'ACME');assert.match(state.jobs.at(-1).match,/Software Engineer/);
 assert.equal(first.errors.length,1);assert.match(first.errors[0],/Couldn’t read the Greenhouse board “broken”/);
 assert.deepEqual(state.watch.seen['lever:acme'].sort(),['acme0','acme1','acme2']);
 assert.equal(state.watch.boards[1].lastError!==undefined,true);
 assert.equal(state.runs.length,1);assert.equal(state.runs[0].added,1);assert.equal(state.runs[0].status,'Job source check');
 assert.deepEqual(state.runs[0].sources,['https://jobs.lever.co/acme','https://job-boards.greenhouse.io/broken']);
 const second=await syncWatchlist(repo,'owner','scheduled',{fetchJson});
 assert.equal(second.added,0);assert.equal(state.jobs.length,2);assert.equal(state.runs[1].status,'Scheduled job source check');
});

test('matches beyond the per-board budget wait for the next check instead of being dropped',async()=>{
 const {repo,state}=fakeRepo({...emptyWatchlist({}),boards:[board('big')]});
 const titles=Array.from({length:20},(_,i)=>'Software Engineer '+i);
 const fetchJson=async()=>leverJobs('big',titles);
 assert.equal((await syncWatchlist(repo,'owner','manual',{fetchJson})).added,15);
 assert.match(state.runs[0].summary,/waiting/);
 assert.equal((await syncWatchlist(repo,'owner','manual',{fetchJson})).added,5);
 assert.equal(state.jobs.length,20);
});

test('the application limit stops a check without marking remaining matches as seen',async()=>{
 const {repo,state}=fakeRepo({...emptyWatchlist({}),boards:[board('acme')]},'Software Engineer',1);
 const result=await syncWatchlist(repo,'owner','manual',{fetchJson:async()=>leverJobs('acme',['Software Engineer','Software Engineer II'])});
 assert.equal(result.added,1);assert.match(result.errors.join(' '),/limit reached/);
 assert.deepEqual(state.watch.seen['lever:acme'],['acme0']);
});

test('the scheduler endpoint fails closed without its secret',()=>{
 const secret='s'.repeat(40);
 assert.throws(()=>authorizeCron('Bearer '+secret,undefined),/not configured/);
 assert.throws(()=>authorizeCron(null,secret),/Invalid/);
 assert.throws(()=>authorizeCron('Bearer wrong',secret),/Invalid/);
 assert.doesNotThrow(()=>authorizeCron('Bearer '+secret,secret));
});

import {catalog,packs,suggestCompanies,companyBySlug} from '../lib/company-catalog';
import {normalizeRemotive,remoteRegionAllowed,emptyWatchlist as emptyWatch} from '../lib/job-boards';
import {remotivePostings} from '../lib/feed-cache';
import {boardKey} from '../lib/job-boards';

test('the catalog has unique, well-formed boards and packs only reference catalog companies',()=>{
 const keys=catalog.map(boardKey);
 assert.equal(new Set(keys).size,keys.length,'no duplicate boards');
 for(const c of catalog)assert.doesNotThrow(()=>parseBoardInput(`https://${c.provider==='greenhouse'?'job-boards.greenhouse.io':c.provider==='lever'?'jobs.lever.co':'jobs.ashbyhq.com'}/${c.slug}`));
 for(const p of packs)for(const slug of p.slugs)assert.ok(companyBySlug(slug),`${p.id} references unknown ${slug}`);
});

test('suggestions favor US-remote listings for remote searches, platform focus for platform roles, and skip watched boards',()=>{
 const profile={criteria:{roles:'Staff Platform Engineer',remote:'US remote only'}};
 const picks=suggestCompanies(profile,[],8);
 assert.equal(picks.length,8);
 assert.ok(picks.every(c=>c.remoteUS),'remote search: US-remote companies first');
 assert.ok(picks.every(c=>c.focus.includes('devtools')||c.focus.includes('infrastructure')),'platform roles: devtools/infrastructure first');
 const without=suggestCompanies(profile,[{provider:'greenhouse',slug:'gitlab'}],40);
 assert.ok(!without.some(c=>c.slug==='gitlab'));
 const office=suggestCompanies({criteria:{roles:'Product Designer',remote:'Austin, TX on-site'}},[],3);
 assert.equal(office.length,3);
});

test('Remotive jobs normalize to remote postings, and US-only searches skip roles restricted to other regions',()=>{
 const postings=normalizeRemotive({'job-count':3,jobs:[
  {id:1,url:'https://remotive.com/remote-jobs/software-dev/staff-backend-engineer-1',title:'Staff Backend Engineer',company_name:'Acme',candidate_required_location:'USA',salary:'$180k - $210k'},
  {id:2,url:'https://remotive.com/remote-jobs/software-dev/2',title:'Platform Engineer',company_name:'Beta',candidate_required_location:'Europe'},
  {id:3,url:'javascript:alert(1)',title:'Bad',company_name:'X'}]});
 assert.deepEqual(postings.map(p=>[p.id,p.remote,p.salary]),[['1',true,'$180k - $210k'],['2',true,undefined]]);
 assert.equal(remoteRegionAllowed('USA','US remote only'),true);
 assert.equal(remoteRegionAllowed('Worldwide','US remote only'),true);
 assert.equal(remoteRegionAllowed('Americas','US remote only'),true);
 assert.equal(remoteRegionAllowed('','US remote only'),true);
 assert.equal(remoteRegionAllowed('Europe','US remote only'),false);
 assert.equal(remoteRegionAllowed('UK, Germany','US remote only'),false);
 assert.equal(remoteRegionAllowed('Europe','Remote anywhere'),true,'no US restriction in the profile');
});

test('a Remotive-only watchlist adds US-eligible matches, credits Remotive, and records the check',async()=>{
 const {repo,state}=fakeRepo({...emptyWatch({}),feeds:{remotive:true}},'Staff Backend Engineer');
 const remotive=async()=>({postings:normalizeRemotive({jobs:[
  {id:1,url:'https://remotive.com/remote-jobs/software-dev/1',title:'Staff Backend Engineer',company_name:'Acme',candidate_required_location:'USA',salary:'$200k'},
  {id:2,url:'https://remotive.com/remote-jobs/software-dev/2',title:'Staff Backend Engineer',company_name:'Beta',candidate_required_location:'Europe only'}]})});
 const result=await syncWatchlist(repo,'owner','scheduled',{fetchJson:async()=>{throw Error('no boards should be read')},remotive});
 assert.equal(result.added,1);
 const job=state.jobs[0];
 assert.equal(job.company,'Acme');assert.equal(job.source,'Remotive · remote job feed');assert.match(job.notes,/remotive\.com/);assert.match(job.notes,/\$200k/);
 assert.match(job.url,/^https:\/\/remotive\.com\//);
 assert.equal(state.watch.feedStatus?.remotive?.lastAdded,1);
 assert.deepEqual(state.watch.seen['feed:remotive'].sort(),['1','2']);
 assert.deepEqual(state.runs[0].sources,['https://remotive.com']);
 const off=await syncWatchlist(repo,'owner','manual',{remotive:async()=>({postings:[],error:'Remotive is unavailable right now; it will be tried again later.'})});
 assert.equal(off.added,0);assert.match(off.errors[0],/unavailable/);
});

/** In-memory stand-in for career_feed_cache that follows the claim query's rules. */
function fakeFeedDb(){
 const t={row:null as null|{payload:any[];fetched_at:Date|null;attempted_at:Date;last_error:string|null}};
 const db={query:async(sql:string,args:any[]=[])=>{
  if(sql.startsWith('SELECT'))return {rows:t.row?[t.row]:[]};
  if(sql.startsWith('INSERT')){
   if(!t.row){t.row={payload:[],fetched_at:null,attempted_at:new Date(),last_error:null};return {rows:[{feed:'remotive'}]}}
   if(Date.now()-t.row.attempted_at.getTime()>6*3600000){t.row.attempted_at=new Date();return {rows:[{feed:'remotive'}]}}
   return {rows:[]};
  }
  if(sql.includes('SET payload')){t.row!.payload=JSON.parse(args[1]);t.row!.fetched_at=new Date();t.row!.last_error=null;return {rows:[]}}
  if(sql.includes('SET last_error')){t.row!.last_error=args[1];return {rows:[]}}
  throw Error('unexpected query '+sql);
 }};
 return {db,t};
}
const feedJson={jobs:[{id:9,url:'https://remotive.com/remote-jobs/x/9',title:'Staff Platform Engineer',company_name:'Gamma',candidate_required_location:'USA'}]};

test('Remotive is fetched at most once per six hours and served from the shared cache in between',async()=>{
 const {db,t}=fakeFeedDb();let calls=0;
 const fetchJson=async(url:string)=>{calls++;assert.equal(url,'https://remotive.com/api/remote-jobs');return feedJson};
 assert.equal((await remotivePostings(db,fetchJson)).postings.length,1);
 for(let i=0;i<5;i++)await remotivePostings(db,fetchJson);
 assert.equal(calls,1,'fresh cache: no further requests');
 t.row!.fetched_at=new Date(Date.now()-13*3600000);
 assert.equal((await remotivePostings(db,fetchJson)).postings.length,1,'stale but recently attempted: serve cache');
 assert.equal(calls,1);
 t.row!.attempted_at=new Date(Date.now()-7*3600000);
 await remotivePostings(db,fetchJson);
 assert.equal(calls,2,'stale and slot free: one refresh');
});

test('a failed Remotive refresh is not retried for six hours and is reported without data',async()=>{
 const {db}=fakeFeedDb();let calls=0;
 const failing=async()=>{calls++;throw Error('503')};
 const first=await remotivePostings(db,failing);
 assert.equal(first.postings.length,0);assert.match(first.error!,/unavailable/);
 await remotivePostings(db,failing);await remotivePostings(db,failing);
 assert.equal(calls,1);
});

import {parsePlaces,locationMatches} from '../lib/places';
test('work locations: a state after a city stays with that city, states and shorthand are understood',()=>{
 const p=(t:string)=>parsePlaces(t).map(x=>[x.city?.join(' ')||'',x.state||'']);
 assert.deepEqual(p('Denver, CO; Texas'),[['denver','CO'],['','TX']]);
 assert.deepEqual(p('Denver, CO, Austin, TX'),[['denver','CO'],['austin','TX']]);
 assert.deepEqual(p('Colorado, Utah'),[['','CO'],['','UT']]);
 assert.deepEqual(p('CO, UT'),[['','CO'],['','UT']]);
 assert.deepEqual(p('New York, NY or Washington, DC'),[['new york','NY'],['washington','DC']]);
 assert.deepEqual(p('Austin TX; NYC; Raleigh'),[['austin','TX'],['new york',''],['raleigh','']]);
});
test('work locations match city, state and multi-office postings without crossing state lines',()=>{
 const m=(loc:string,places:string)=>locationMatches(loc,parsePlaces(places));
 assert.equal(m('Denver, CO','Colorado'),true);
 assert.equal(m('Denver, Colorado, United States','CO'),true);
 assert.equal(m('Austin, TX','Colorado'),false);
 assert.equal(m('Portland, OR','Portland, ME'),false);
 assert.equal(m('Portland, ME','Portland, ME'),true);
 assert.equal(m('Portland','Portland, ME'),true);
 assert.equal(m('San Francisco, CA / New York, NY','New York, NY'),true);
 assert.equal(m('Washington, DC','Washington'),false);
 assert.equal(m('Seattle, Washington','Washington'),true);
 assert.equal(m('Seattle, WA','Washington, DC'),false);
 assert.equal(m('Tulsa, OK','Oklahoma'),true);
 assert.equal(m('Dublin, Ireland','Texas'),false);
});
test('the title filter applies work locations to on-site roles only',()=>{
 const post=(location:string,remote:boolean)=>({id:location,title:'Software Engineer',url:'https://x.test/'+location,location,remote,company:'X'});
 const c={roles:'Software Engineer',keywords:'',exclude:'',remoteOnly:false,places:'Denver, CO; Texas'};
 assert.equal(matchPosting(post('Denver, CO',false),c),'Software Engineer');
 assert.equal(matchPosting(post('Houston, Texas',false),c),'Software Engineer');
 assert.equal(matchPosting(post('New York, NY',false),c),null);
 assert.equal(matchPosting(post('Remote - US',true),c),'Software Engineer');
 assert.equal(matchPosting(post('',false),c),'Software Engineer');
 assert.equal(matchPosting(post('New York, NY',false),{...c,places:''}),'Software Engineer');
});
test('work locations are saved with the other watchlist settings',()=>{
 const {next}=applySettings(emptyWatchlist({}),{boards:[],remoteOnly:false,places:'Denver, CO'});
 assert.equal(next.places,'Denver, CO');
 assert.equal(applySettings(emptyWatchlist({}),{boards:[],remoteOnly:false}).next.places,'');
});
