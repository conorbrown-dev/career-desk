// Built-in companies a user can watch with one click. Every board below answered its public API with open roles
// when checked; `remoteUS` means at least one listing was marked remote in the US at that time. Boards that stop
// answering are skipped on add and flagged by the daily check, so a stale entry never blocks anyone.
import {boardKey,type Provider} from './job-boards';

export const catalogCheckedOn='2026-10-27';
export type Focus='devtools'|'infrastructure'|'data-ai'|'fintech'|'security'|'product';
export type CatalogCompany={name:string;provider:Provider;slug:string;focus:Focus[];remoteUS:boolean};

export const catalog:CatalogCompany[]=[
 {name:'GitLab',provider:'greenhouse',slug:'gitlab',focus:['devtools'],remoteUS:true},
 {name:'Datadog',provider:'greenhouse',slug:'datadog',focus:['devtools','infrastructure'],remoteUS:true},
 {name:'Grafana Labs',provider:'greenhouse',slug:'grafanalabs',focus:['devtools','infrastructure'],remoteUS:true},
 {name:'PagerDuty',provider:'greenhouse',slug:'pagerduty',focus:['devtools','infrastructure'],remoteUS:true},
 {name:'Twilio',provider:'greenhouse',slug:'twilio',focus:['devtools','infrastructure'],remoteUS:true},
 {name:'Netlify',provider:'greenhouse',slug:'netlify',focus:['devtools'],remoteUS:true},
 {name:'Linear',provider:'ashby',slug:'linear',focus:['devtools','product'],remoteUS:true},
 {name:'Supabase',provider:'ashby',slug:'supabase',focus:['devtools','data-ai'],remoteUS:true},
 {name:'PostHog',provider:'ashby',slug:'posthog',focus:['devtools','data-ai'],remoteUS:true},
 {name:'Vanta',provider:'ashby',slug:'vanta',focus:['security'],remoteUS:true},
 {name:'Stripe',provider:'greenhouse',slug:'stripe',focus:['fintech','infrastructure'],remoteUS:true},
 {name:'Coinbase',provider:'greenhouse',slug:'coinbase',focus:['fintech'],remoteUS:true},
 {name:'Gusto',provider:'greenhouse',slug:'gusto',focus:['fintech'],remoteUS:true},
 {name:'Affirm',provider:'greenhouse',slug:'affirm',focus:['fintech'],remoteUS:true},
 {name:'Databricks',provider:'greenhouse',slug:'databricks',focus:['data-ai','infrastructure'],remoteUS:true},
 {name:'Dropbox',provider:'greenhouse',slug:'dropbox',focus:['product','infrastructure'],remoteUS:true},
 {name:'Samsara',provider:'greenhouse',slug:'samsara',focus:['product','infrastructure'],remoteUS:true},
 {name:'Discord',provider:'greenhouse',slug:'discord',focus:['product'],remoteUS:true},
 {name:'Reddit',provider:'greenhouse',slug:'reddit',focus:['product'],remoteUS:true},
 {name:'Asana',provider:'greenhouse',slug:'asana',focus:['product'],remoteUS:true},
 {name:'Airtable',provider:'greenhouse',slug:'airtable',focus:['product'],remoteUS:true},
 {name:'Instacart',provider:'greenhouse',slug:'instacart',focus:['product'],remoteUS:true},
 {name:'Airbnb',provider:'greenhouse',slug:'airbnb',focus:['product'],remoteUS:true},
 {name:'Duolingo',provider:'greenhouse',slug:'duolingo',focus:['product'],remoteUS:true},
 {name:'Zapier',provider:'ashby',slug:'zapier',focus:['product','devtools'],remoteUS:true},
 {name:'Cloudflare',provider:'greenhouse',slug:'cloudflare',focus:['infrastructure','security'],remoteUS:false},
 {name:'Fastly',provider:'greenhouse',slug:'fastly',focus:['infrastructure'],remoteUS:false},
 {name:'Vercel',provider:'greenhouse',slug:'vercel',focus:['devtools','infrastructure'],remoteUS:false},
 {name:'Sentry',provider:'ashby',slug:'sentry',focus:['devtools'],remoteUS:false},
 {name:'MongoDB',provider:'greenhouse',slug:'mongodb',focus:['data-ai','infrastructure'],remoteUS:false},
 {name:'Elastic',provider:'greenhouse',slug:'elastic',focus:['data-ai','devtools'],remoteUS:false},
 {name:'Cockroach Labs',provider:'greenhouse',slug:'cockroachlabs',focus:['data-ai','infrastructure'],remoteUS:false},
 {name:'OpenAI',provider:'ashby',slug:'openai',focus:['data-ai'],remoteUS:false},
 {name:'Palantir',provider:'lever',slug:'palantir',focus:['data-ai'],remoteUS:false},
 {name:'Okta',provider:'greenhouse',slug:'okta',focus:['security'],remoteUS:false},
 {name:'Robinhood',provider:'greenhouse',slug:'robinhood',focus:['fintech'],remoteUS:false},
 {name:'Ramp',provider:'ashby',slug:'ramp',focus:['fintech'],remoteUS:false},
 {name:'Figma',provider:'greenhouse',slug:'figma',focus:['product'],remoteUS:false},
 {name:'Notion',provider:'ashby',slug:'notion',focus:['product'],remoteUS:false},
 {name:'Lyft',provider:'greenhouse',slug:'lyft',focus:['product'],remoteUS:false},
 {name:'Spotify',provider:'lever',slug:'spotify',focus:['product'],remoteUS:false}
];

export type Pack={id:string;name:string;description:string;slugs:string[]};
export const packs:Pack[]=[
 {id:'remote-devtools',name:'Remote-friendly dev tools & infrastructure',description:'Developer platforms, observability and cloud tooling with US-remote listings.',slugs:['gitlab','datadog','grafanalabs','pagerduty','twilio','netlify','linear','supabase','posthog','vanta']},
 {id:'remote-fintech',name:'Remote-friendly fintech',description:'Payments, payroll and finance companies with US-remote listings.',slugs:['stripe','coinbase','gusto','affirm']},
 {id:'remote-product',name:'Remote-friendly product companies',description:'Consumer and work apps with US-remote listings.',slugs:['dropbox','samsara','discord','reddit','asana','airtable','instacart','airbnb','duolingo','zapier']},
 {id:'data-ai',name:'Data & AI',description:'Databases, analytics and AI companies. Several are office- or hybrid-first.',slugs:['databricks','mongodb','elastic','cockroachlabs','openai','palantir']}
];
export const companyBySlug=(slug:string)=>catalog.find(c=>c.slug===slug);

const has=(text:string,pattern:RegExp)=>pattern.test(text.toLowerCase());
/** Ranks catalog companies for a profile: remote listings first when the search is remote, then fields the target roles point to. */
export function suggestCompanies(profile:any,watched:{provider:Provider;slug:string}[],limit=8):CatalogCompany[]{
 const roles=String(profile?.criteria?.roles||''),remote=has(String(profile?.criteria?.remote||''),/\bremote\b/);
 const taken=new Set(watched.map(boardKey));
 const wants:Partial<Record<Focus,number>>={
  infrastructure:has(roles,/platform|infrastructure|backend|back-end|sre|site reliability|devops|cloud|systems/)?2:0,
  devtools:has(roles,/platform|developer|devtools|tooling|backend|full ?stack|software/)?2:0,
  'data-ai':has(roles,/data|machine learning|\bml\b|\bai\b|analytics|scientist/)?2:0,
  fintech:has(roles,/fintech|payments|finance|financial/)?2:0,
  security:has(roles,/security|identity/)?2:0,
  product:has(roles,/product|designer|frontend|front-end|mobile|ios|android/)?1:0
 };
 const score=(c:CatalogCompany)=>(remote&&c.remoteUS?3:0)+Math.max(0,...c.focus.map(f=>wants[f]||0));
 return catalog.filter(c=>!taken.has(boardKey(c))).map((c,i)=>({c,i,s:score(c)})).sort((a,b)=>b.s-a.s||a.i-b.i).slice(0,limit).map(x=>x.c);
}
export const focusLabels:Record<Focus,string>={devtools:'Dev tools',infrastructure:'Infrastructure','data-ai':'Data & AI',fintech:'Fintech',security:'Security',product:'Product'};
