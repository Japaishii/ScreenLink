import Workspace from '../components/workspace';
import type {Metadata} from 'next';
export const metadata:Metadata={title:'Seu espaço — Screenlink',robots:{index:false,follow:false}};
export default function AppPage(){return <Workspace/>;}
