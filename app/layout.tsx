import type { Metadata, Viewport } from 'next';
import './globals.css';
import './studio-base.css';
import './studio.css';
import './responsive.css';
import './landing.css';
import './community.css';
export const metadata: Metadata = { title: 'Screenlink — Sua tela, nossa conexão', description: 'Crie seu espaço, convide sua comunidade e compartilhe sua tela em tempo real.' };
export const viewport:Viewport={width:'device-width',initialScale:1,interactiveWidget:'resizes-content',themeColor:'#0d1014'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="pt-BR"><body>{children}</body></html>;}
