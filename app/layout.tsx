import type {Metadata} from 'next';
import './globals.css';
import ThemeToggle from './theme-toggle';
const themeScript="try{var t=localStorage.getItem('career-desk-theme');document.documentElement.dataset.theme=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light'}catch{document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}";
export const metadata:Metadata={title:'Career Desk | Thoughtful career moves',description:'A free-first workspace for developer job searches. Track opportunities, ground applications in real experience, and keep the exact documents you send.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:themeScript}}/></head><body><ThemeToggle/>{children}</body></html>}
