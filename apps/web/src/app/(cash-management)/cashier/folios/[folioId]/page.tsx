'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { FolioDetailView } from '@/components/finance/FolioDetailView';

function CashierFolioContent() {
  const { folioId } = useParams<{ folioId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  
  const isGeneralCashier = session?.user?.role === 'GENERAL_CASHIER';
  
  return (
    <main className="max-w-6xl p-6">
      <FolioDetailView folioId={folioId} eventInvoiceId={searchParams.get('eventInvoiceId') || undefined} onBack={() => router.back()} readOnly={isGeneralCashier} />
    </main>
  );
}

export default function CashierFolioPage() {
  return <Suspense fallback={<main className="max-w-6xl p-6" />}><CashierFolioContent /></Suspense>;
}
