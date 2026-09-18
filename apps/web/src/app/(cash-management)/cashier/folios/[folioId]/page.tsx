'use client';

import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FolioDetailView } from '@/components/finance/FolioDetailView';

export default function CashierFolioPage() {
  const { folioId } = useParams<{ folioId: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  
  const isGeneralCashier = session?.user?.role === 'GENERAL_CASHIER';
  
  return (
    <main className="max-w-6xl p-6">
      <FolioDetailView folioId={folioId} onBack={() => router.back()} readOnly={isGeneralCashier} />
    </main>
  );
}
