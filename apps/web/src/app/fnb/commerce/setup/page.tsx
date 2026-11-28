import { Metadata } from 'next';
import { CommerceSetupClient } from './client';
export const metadata: Metadata = { title: 'Store Setup | Food Commerce' };
export default async function CommerceSetupPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  return <CommerceSetupClient initialTab={params.tab} />;
}
