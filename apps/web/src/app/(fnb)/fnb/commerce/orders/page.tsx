import { Metadata } from 'next';
import { CommerceOrdersClient } from './client';

export const metadata: Metadata = { title: 'Live Orders | Food Commerce' };
export default function CommerceOrdersPage() {
  return <CommerceOrdersClient />;
}
