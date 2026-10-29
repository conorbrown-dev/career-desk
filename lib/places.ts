// Work-location matching for the daily job check: lets someone anywhere in the US say where they'll work on-site
// ("Denver, CO; Texas") so on-site and hybrid roles elsewhere are skipped. Pure functions, shared by browser and server.

const stateList:[string,string][]=[
 ['AL','alabama'],['AK','alaska'],['AZ','arizona'],['AR','arkansas'],['CA','california'],['CO','colorado'],['CT','connecticut'],
 ['DE','delaware'],['DC','district of columbia'],['FL','florida'],['GA','georgia'],['HI','hawaii'],['ID','idaho'],['IL','illinois'],
 ['IN','indiana'],['IA','iowa'],['KS','kansas'],['KY','kentucky'],['LA','louisiana'],['ME','maine'],['MD','maryland'],
 ['MA','massachusetts'],['MI','michigan'],['MN','minnesota'],['MS','mississippi'],['MO','missouri'],['MT','montana'],
 ['NE','nebraska'],['NV','nevada'],['NH','new hampshire'],['NJ','new jersey'],['NM','new mexico'],['NY','new york'],
 ['NC','north carolina'],['ND','north dakota'],['OH','ohio'],['OK','oklahoma'],['OR','oregon'],['PA','pennsylvania'],
 ['PR','puerto rico'],['RI','rhode island'],['SC','south carolina'],['SD','south dakota'],['TN','tennessee'],['TX','texas'],
 ['UT','utah'],['VT','vermont'],['VA','virginia'],['WA','washington'],['WV','west virginia'],['WI','wisconsin'],['WY','wyoming']
];
const byAbbr=new Map(stateList);
const byName=new Map(stateList.map(([a,n])=>[n,a]));
// Common shorthand people type for big metros.
const cityAliases:Record<string,string>={nyc:'new york',sf:'san francisco','bay area':'san francisco',la:'los angeles',philly:'philadelphia',dfw:'dallas'};

export type Place={label:string;city?:string[];state?:string};

const words=(text:string)=>text.toLowerCase().replace(/&/g,' and ').split(/[^a-z0-9]+/).filter(Boolean);
const hasRun=(hay:string[],needle:string[],from=0)=>{
 for(let i=from;i+needle.length<=hay.length;i++)if(needle.every((w,j)=>hay[i+j]===w))return i;
 return -1;
};
const stateOf=(token:string)=>{
 const t=token.trim();
 if(/^[A-Za-z]{2}$/.test(t)&&byAbbr.has(t.toUpperCase()))return t.toUpperCase();
 return byName.get(words(t).join(' '));
};

/** Reads a free-text list such as "Denver, CO; Texas; Austin TX or NYC".
 *  A two-letter state after a city stays with that city ("Denver, CO" is one place, not all of Colorado). */
export function parsePlaces(text:string):Place[]{
 const out:Place[]=[];
 for(const group of String(text||'').split(/[;\n|]+|\s+or\s+/i)){
  let prev:Place|null=null,prevWasAbbr=false;
  for(const raw of group.split(',')){
   const token=raw.trim();if(!words(token).length)continue;
   const isAbbr=/^[A-Za-z]{2}$/.test(token)&&byAbbr.has(token.toUpperCase());
   if(isAbbr&&prev&&!prevWasAbbr&&(prev.city?!prev.state:true)){
    // "Denver, CO": the state belongs to the city before it. "New York, NY" or "Washington, DC": the city's
    // name is also a state's name, so the earlier token was read as a whole state; it's really the city.
    if(!prev.city)prev.city=words(prev.label);
    prev.state=token.toUpperCase();prev.label+=', '+token.toUpperCase();prevWasAbbr=true;continue;
   }
   const state=stateOf(token);
   let place:Place;
   if(state)place={label:token,state};
   else{
    // "Austin TX" without a comma.
    const m=token.match(/^(.*\S)\s+([A-Za-z]{2})$/);
    const tail=m&&byAbbr.has(m[2].toUpperCase())?m[2].toUpperCase():undefined;
    const cityText=tail?m![1]:token;
    const city=words(cityAliases[cityText.toLowerCase()]||cityText);
    place={label:token,city,...(tail?{state:tail}:{})};
   }
   out.push(place);prev=place;prevWasAbbr=isAbbr;
  }
 }
 return out.slice(0,40);
}

/** States a location segment names, by two-letter code ("Denver, CO") or full name ("Denver, Colorado"). */
function statesIn(segment:string):Set<string>{
 const found=new Set<string>();
 for(const m of segment.match(/\b[A-Z]{2}\b/g)||[])if(byAbbr.has(m)&&m!=='US')found.add(m);
 const w=words(segment);
 for(const [abbr,name] of stateList){
  const at=hasRun(w,name.split(' '));
  if(at<0)continue;
  // "Washington, DC" names the city, not Washington state.
  if(abbr==='WA'&&(w[at+1]==='dc'||(w[at+1]==='d'&&w[at+2]==='c')))continue;
  found.add(abbr);
 }
 return found;
}

/** True when any part of a posting's location (offices are often joined with "/" or ";") is one of the places. */
export function locationMatches(location:string,places:Place[]):boolean{
 const segments=String(location||'').split(/\s*(?:\/|;|\||·|\bor\b)\s*/).filter(s=>s.trim());
 return segments.some(segment=>{
  const w=words(segment),states=statesIn(segment);
  return places.some(p=>{
   if(!p.city)return !!p.state&&states.has(p.state);
   if(hasRun(w,p.city)<0)return false;
   // A city with a state ("Portland, ME") must not match the same city name in another state ("Portland, OR").
   return !p.state||states.size===0||states.has(p.state);
  });
 });
}
