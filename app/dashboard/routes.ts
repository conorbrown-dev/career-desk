// URL scheme for the workspace, so each tab, section and open opportunity has its own history entry:
//   {base}                      Overview
//   {base}/opportunities        Opportunities         {base}/applications   Applications
//   {base}/documents            Documents             {base}/profile        Search profile
//   {base}/profile/sources      Search profile, scrolled to automatic job sources
//   ?job=<id> | ?job=new        the opportunity panel, over whichever tab is showing
export const tabs=[
 {name:'Overview',slug:''},
 {name:'Opportunities',slug:'opportunities'},
 {name:'Applications',slug:'applications'},
 {name:'Documents',slug:'documents'},
 {name:'Search profile',slug:'profile'}
] as const;
export type Tab=typeof tabs[number]['name'];
export const sections={sources:'job-boards'} as const;
export type Section=keyof typeof sections;
const sectionTabs:Record<Section,Tab>={sources:'Search profile'};

/** Accepts the catch-all segments after the base path; anything else is a 404. */
export function parseSegments(segments:string[]=[]):{tab:Tab;section?:Section}|null{
 const [first='',second,...rest]=segments;
 const tab=tabs.find(t=>t.slug===first);
 if(!tab||rest.length)return null;
 if(second===undefined)return {tab:tab.name};
 const section=(Object.keys(sections) as Section[]).find(s=>s===second&&sectionTabs[s]===tab.name);
 return section?{tab:tab.name,section}:null;
}
export function parsePath(pathname:string,base:string){
 const rest=pathname.startsWith(base)?pathname.slice(base.length):'';
 return parseSegments(rest.split('/').filter(Boolean))||{tab:'Overview' as Tab};
}
export function tabPath(base:string,tab:Tab,section?:Section){
 const slug=tabs.find(t=>t.name===tab)?.slug||'';
 return base+(slug?'/'+slug:'')+(section?'/'+section:'');
}
export function withJob(path:string,job:string|null){return job?`${path}?job=${encodeURIComponent(job)}`:path}
