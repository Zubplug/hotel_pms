'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DepositActionButton({ depositId, currentStatus }: { depositId: string, currentStatus: string }) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  if (!['PENDING_HANDOVER', 'DEPOSITED'].includes(currentStatus)) {
    return null;
  }

  const handleAction = async () => {
    if (currentStatus === 'PENDING_HANDOVER') {
      const bankReference = prompt('Enter Bank Reference or Receipt Number:');
      if (bankReference === null) return;

      setIsLoading(true);
      try {
        const res = await fetch(`/api/v1/financial-control/deposits/${depositId}/submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bankReference })
        });
        if (!res.ok) throw new Error((await res.json()).error);
        router.refresh();
      } catch (error: any) {
        alert(error.message);
      } finally {
        setIsLoading(false);
      }
    } else if (currentStatus === 'DEPOSITED') {
      const amountStr = prompt('Enter actual amount confirmed by the bank:');
      if (amountStr === null) return;
      const amount = Number(amountStr);
      if (isNaN(amount)) return alert('Invalid amount');

      setIsLoading(true);
      try {
        const verifyRes = await fetch(`/api/v1/financial-control/deposits/${depositId}/verify`, { method: 'POST' });
        if (!verifyRes.ok) throw new Error((await verifyRes.json()).error);

        const reconcileRes = await fetch(`/api/v1/financial-control/deposits/${depositId}/verify`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bankConfirmedAmount: amount, notes: 'Reconciled from UI' })
        });
        if (!reconcileRes.ok) throw new Error((await reconcileRes.json()).error);
        router.refresh();
      } catch (error: any) {
        alert(error.message);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <button
      onClick={handleAction}
      disabled={isLoading}
      className={`inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-slate-950 disabled:pointer-events-none disabled:opacity-50 h-8 px-3 ${
        currentStatus === 'PENDING_HANDOVER' ? 'bg-blue-600 text-white hover:bg-blue-600/90' : 'bg-emerald-600 text-white hover:bg-emerald-600/90'
      }`}
    >
      {isLoading ? 'Processing...' : currentStatus === 'PENDING_HANDOVER' ? 'Submit to Bank' : 'Reconcile'}
    </button>
  );
}
