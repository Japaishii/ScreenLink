import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Screenlink — Sua tela, nossa conexão', description: 'Crie seu espaço, convide sua comunidade e compartilhe sua tela em tempo real.' };
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="pt-BR"><body>{children}</body></html>;}
