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
 assert.throws(()=>applySettings(current,{boards:Array.from({length:26},(_,i)=>({provider:'lever',slug:'c'+i})),remoteOnly:false}),/up to 25/);
 assert.throws(()=>applySettings(current,{boards:[],remoteOnly:false,extra:true}));
});

function fakeRepo(watch:Watchlist,roles='Software Engineer',limit=250){
 const state={watch:structuredClone(watch),jobs:[] as any[],runs:[] as any[]};
 const repo:any={
  watchlist:async()=>structuredClone(state.watch),
  updateWatchlist:async(_o:string,change:(w:any)=>any)=>{const n=change(structuredClone(state.watch));if(n!==null)state.watch=n;return state.watch},
  profile:async()=>({criteria:{roles}}),
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
 const first=await syncWatchlist(repo,'owner','manual',fetchJson);
 assert.equal(first.added,1,'Only the unseen match not already in the pipeline is added');
 assert.equal(state.jobs.at(-1).company,'ACME');assert.match(state.jobs.at(-1).match,/Software Engineer/);
 assert.equal(first.errors.length,1);assert.match(first.errors[0],/Couldn’t read the Greenhouse board “broken”/);
 assert.deepEqual(state.watch.seen['lever:acme'].sort(),['acme0','acme1','acme2']);
 assert.equal(state.watch.boards[1].lastError!==undefined,true);
 assert.equal(state.runs.length,1);assert.equal(state.runs[0].added,1);assert.equal(state.runs[0].status,'Job board check');
 assert.deepEqual(state.runs[0].sources,['https://jobs.lever.co/acme','https://job-boards.greenhouse.io/broken']);
 const second=await syncWatchlist(repo,'owner','scheduled',fetchJson);
 assert.equal(second.added,0);assert.equal(state.jobs.length,2);assert.equal(state.runs[1].status,'Scheduled job board check');
});

test('matches beyond the per-board budget wait for the next check instead of being dropped',async()=>{
 const {repo,state}=fakeRepo({...emptyWatchlist({}),boards:[board('big')]});
 const titles=Array.from({length:20},(_,i)=>'Software Engineer '+i);
 const fetchJson=async()=>leverJobs('big',titles);
 assert.equal((await syncWatchlist(repo,'owner','manual',fetchJson)).added,15);
 assert.match(state.runs[0].summary,/waiting/);
 assert.equal((await syncWatchlist(repo,'owner','manual',fetchJson)).added,5);
 assert.equal(state.jobs.length,20);
});

test('the application limit stops a check without marking remaining matches as seen',async()=>{
 const {repo,state}=fakeRepo({...emptyWatchlist({}),boards:[board('acme')]},'Software Engineer',1);
 const result=await syncWatchlist(repo,'owner','manual',async()=>leverJobs('acme',['Software Engineer','Software Engineer II']));
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
