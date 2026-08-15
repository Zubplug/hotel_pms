'use client';

import { useParams } from 'next/navigation';
import { PaymentReceipt } from '@/components/payments/PaymentReceipt';

export default function FrontDeskReceiptPage() {
  const { id } = useParams() as { id: string };
  return <PaymentReceipt id={id} />;
}
