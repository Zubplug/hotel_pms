import { Metadata } from 'next';
import { CommerceAnalyticsClient } from './client';
export const metadata: Metadata = { title: 'Analytics | Food Commerce' };
export default function CommerceAnalyticsPage() { return <CommerceAnalyticsClient />; }
