import { Metadata } from 'next';
import { CommerceSetupClient } from './client';
export const metadata: Metadata = { title: 'Store Setup | Food Commerce' };
export default function CommerceSetupPage() { return <CommerceSetupClient />; }
