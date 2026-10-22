'use client';
import {useState} from 'react';
export default function Connections({connections}:{connections:{id:string;name:string;permissions:string[]}[]}){
 const [items,setItems]=useState(connections),[error,setError]=useState(''),[busy,setBusy]=useState('');
 async function revoke(id:string){setBusy(id);setError('');try{const r=await fetch('/api/connections',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})});if(!r.ok)throw Error('Could not disconnect. Try again.');setItems(v=>v.filter(i=>i.id!==id))}catch(e){setError(e instanceof Error?e.message:'Could not disconnect')}finally{setBusy('')}}
 return <div>{!items.length&&<p>No connections yet.</p>}{items.map(item=><section key={item.id} className="panel connection-card"><strong>{item.name}</strong><ul>{item.permissions.map(p=><li key={p}>{p}</li>)}</ul><button className="secondary" disabled={!!busy} onClick={()=>revoke(item.id)}>{busy===item.id?'Disconnecting…':'Disconnect'}</button></section>)}{error&&<p className="error" role="alert">{error}</p>}</div>
}
