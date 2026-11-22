import type {Metadata} from 'next';
import {redirect} from 'next/navigation';
import {Landing} from './components/landing';
export const metadata:Metadata={title:'Screenlink — Sua galera, no mesmo espaço',description:'Compartilhe tela, câmera, voz e conversa em um só lugar. Crie seu espaço no Screenlink, convide seus amigos e conheça a proposta Plus.'};
export default async function Home({searchParams}:{searchParams:Promise<{room?:string|string[]}>}){
 const query=await searchParams;const room=Array.isArray(query.room)?query.room[0]:query.room;
 if(room)redirect('/app?room='+encodeURIComponent(room));
 return <Landing/>;
}
