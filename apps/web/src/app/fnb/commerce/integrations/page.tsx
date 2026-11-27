import { Metadata } from 'next';
import { CommerceIntegrationsClient } from './client';
export const metadata: Metadata = { title: 'Integrations | Food Commerce' };
export default function CommerceIntegrationsPage() { return <CommerceIntegrationsClient />; }
