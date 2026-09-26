'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { FolioDetailView } from '@/components/finance/FolioDetailView';

function FrontDeskFolioQueryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const folioId = searchParams.get('folioId');

  if (!folioId) {
    return (
      <main className="min-h-full bg-slate-50 p-6">
        <p className="text-sm text-slate-500">No folio was selected.</p>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-slate-50 p-4 sm:p-6">
      <FolioDetailView
        folioId={folioId}
        eventInvoiceId={searchParams.get('eventInvoiceId') || undefined}
        onBack={() => router.back()}
      />
    </main>
  );
}

export default function FrontDeskFolioQueryPage() {
  return (
    <Suspense fallback={<main className="min-h-full bg-slate-50 p-6" />}>
      <FrontDeskFolioQueryContent />
    </Suspense>
  );
}
