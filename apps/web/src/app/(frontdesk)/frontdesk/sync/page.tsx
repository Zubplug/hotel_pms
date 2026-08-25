import { useRouter } from 'next/navigation';
import { SyncCenterPanel } from '@/components/sync/SyncCenterPanel';

export default function SyncCenterPage() {
  const router = useRouter();
  return <SyncCenterPanel onClose={() => router.push('/frontdesk')} />;
}
