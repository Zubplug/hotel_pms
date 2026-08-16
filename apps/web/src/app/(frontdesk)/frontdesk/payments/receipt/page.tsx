'use client';

import { useSearchParams } from 'next/navigation';
import { PaymentReceipt } from '@/components/payments/PaymentReceipt';

export default function FrontDeskReceiptPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  
  if (!id) return <div>No receipt ID provided.</div>;
  
  return <PaymentReceipt id={id} />;
}
