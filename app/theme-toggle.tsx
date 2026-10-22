'use client';
import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
const preferenceKey='career-desk-theme';
export default function ThemeToggle(){
 const [dark,setDark]=useState(false);
 useEffect(()=>{
  const media=window.matchMedia('(prefers-color-scheme: dark)');
  function sync(){let saved:string|null=null;try{saved=localStorage.getItem(preferenceKey)}catch{}const next=saved==='dark'||(saved!=='light'&&media.matches);document.documentElement.dataset.theme=next?'dark':'light';setDark(next)}
  sync();media.addEventListener('change',sync);window.addEventListener('storage',sync);
  return ()=>{media.removeEventListener('change',sync);window.removeEventListener('storage',sync)};
 },[]);
 return <button className="theme-toggle" aria-label="Toggle dark mode" aria-pressed={dark} title="Toggle dark mode" onClick={()=>{const next=document.documentElement.dataset.theme!=='dark';document.documentElement.dataset.theme=next?'dark':'light';setDark(next);try{localStorage.setItem(preferenceKey,next?'dark':'light')}catch{}}}><Moon className="theme-moon" size={17}/><Sun className="theme-sun" size={17}/><span>Theme</span></button>;
}
