import { Metadata } from 'next';
import { CommerceCustomersClient } from './client';
export const metadata: Metadata = { title: 'Customers | Food Commerce' };
export default function CommerceCustomersPage() { return <CommerceCustomersClient />; }
