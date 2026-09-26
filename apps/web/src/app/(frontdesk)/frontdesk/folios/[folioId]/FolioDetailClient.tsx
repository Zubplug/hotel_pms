'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { FolioDetailView } from '@/components/finance/FolioDetailView';

function FrontDeskFolioContent() {
  const { folioId } = useParams<{ folioId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  if (folioId === '__desktop__') {
    return (
      <main className="min-h-full bg-slate-50 p-6">
        <p className="text-sm text-slate-500">Select a folio to continue.</p>
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

export default function FolioDetailClient() {
  return (
    <Suspense fallback={<main className="min-h-full bg-slate-50 p-6" />}>
      <FrontDeskFolioContent />
    </Suspense>
  );
}
