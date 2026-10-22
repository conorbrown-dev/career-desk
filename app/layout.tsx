import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'Career Desk | Thoughtful career moves',description:'A free-first workspace for developer job searches. Track opportunities, ground applications in real experience, and keep the exact documents you send.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
