import { Metadata } from 'next';
import { CommerceMenuClient } from './client';
export const metadata: Metadata = { title: 'Menu Studio | Food Commerce' };
export default function CommerceMenuPage() { return <CommerceMenuClient />; }
