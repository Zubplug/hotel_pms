'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PaymentReceipt } from '@/components/payments/PaymentReceipt';

function ReceiptContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  
  if (!id) return <div>No receipt ID provided.</div>;
  
  return <PaymentReceipt id={id} />;
}

export default function FrontDeskReceiptPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500">Loading receipt...</div>}>
      <ReceiptContent />
    </Suspense>
  );
}
