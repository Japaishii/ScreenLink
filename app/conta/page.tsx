import {LegalPage} from '../components/legal-page';
import {AccountData} from '../components/account-data';
export const metadata={title:'Minha conta e dados — Screenlink',robots:{index:false,follow:false}};
export default function Account(){return <LegalPage title="Minha conta e meus dados" intro="Exporte suas informações ou encerre sua conta pelo autoatendimento." draft={false}><AccountData/></LegalPage>;}
