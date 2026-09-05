'use client';

import { useParams, useRouter } from 'next/navigation';
import { FolioDetailView } from '@/components/finance/FolioDetailView';

export default function CashierFolioPage() {
  const { folioId } = useParams<{ folioId: string }>();
  const router = useRouter();
  
  return (
    <main className="max-w-6xl p-6">
      <FolioDetailView folioId={folioId} onBack={() => router.back()} />
    </main>
  );
}
