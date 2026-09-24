'use client';

import { useRouter } from 'next/navigation';
import { SyncCenterPanel } from '@/components/sync/SyncCenterPanel';
import { goBack } from '@/lib/frontdesk-navigation';

export default function SyncCenterPage() {
  const router = useRouter();
  return <SyncCenterPanel onClose={() => goBack(router, '/frontdesk')} />;
}
