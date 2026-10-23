'use client';
import {useState} from 'react';
import {CheckCircle2,ArrowRight} from 'lucide-react';

const localToday=()=>{const d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10);};
const preparation=['Discovered','Preparing','Ready for review'];

type Props={
 job:any;
 stages:readonly string[];
 busy:boolean;
 onDraftChange:(changes:{stage?:string;appliedDate?:string})=>void;
 onSubmit:(changes:{stage:string;appliedDate:string})=>void;
};

export default function StageBar({job,stages,busy,onDraftChange,onSubmit}:Props){
 const saved=!!job.id;
 const [stage,setStage]=useState<string>(saved&&job.stage==='Ready for review'?'Applied':job.stage);
 const [date,setDate]=useState<string>(job.appliedDate||localToday());
 const current=saved?job.stage:stage;
 const markingApplied=stage==='Applied'&&(!saved||job.stage!=='Applied');
 const changed=stage!==job.stage;
 const pick=(value:string)=>{setStage(value);if(!saved)onDraftChange({stage:value,...(value==='Applied'?{appliedDate:date}:{})});};
 const pickDate=(value:string)=>{setDate(value);if(!saved)onDraftChange({appliedDate:value});};
 const tone=current==='Applied'||['Recruiter screen','Interview','Offer'].includes(current)?'green':current==='Ready for review'?'orange':'neutral';
 return <section className={'stage-bar '+(markingApplied?'applying':'')} aria-label="Application status">
  <div className="stage-bar-head">
   <span className="eyebrow">APPLICATION STATUS</span>
   <span className={'pill '+tone}>{saved?job.stage:'New · '+stage}</span>
  </div>
  {saved&&preparation.includes(job.stage)&&<p className="stage-bar-hint">Submitted this on the employer’s site? Choose <strong>Applied</strong>, confirm the submission date, and mark it applied.</p>}
  <div className="stage-bar-controls">
   <label>Stage<select value={stage} onChange={e=>pick(e.target.value)}>{stages.map(s=><option key={s}>{s}</option>)}</select></label>
   {markingApplied&&<label>Confirmed submission date<input type="date" required max={localToday()} value={date} onChange={e=>pickDate(e.target.value)}/></label>}
   {saved&&<button className="primary stage-bar-submit" disabled={busy||!changed||(markingApplied&&!date)} onClick={()=>onSubmit({stage,appliedDate:markingApplied?date:job.appliedDate||''})}>
    {markingApplied?<><CheckCircle2 size={17}/>Mark as applied</>:<>Update stage<ArrowRight size={16}/></>}
   </button>}
  </div>
 </section>;
}
