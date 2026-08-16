'use client';

export function generateStaticParams() { return []; }

import { useParams } from 'next/navigation';
import { PaymentReceipt } from '@/components/payments/PaymentReceipt';

export default function ReceiptPage() {
  const { id } = useParams() as { id: string };
  return <PaymentReceipt id={id} />;
}
