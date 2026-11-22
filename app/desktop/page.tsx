import type { Metadata } from 'next';
import { Desktop } from '../components/desktop';
import './desktop.css';

export const metadata: Metadata = {
 title: 'Screenlink Desktop',
 robots: { index: false, follow: false },
};

export default function DesktopPage() {
 return <Desktop />;
}
