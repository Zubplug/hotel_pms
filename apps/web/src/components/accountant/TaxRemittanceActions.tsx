'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Loader2, X } from 'lucide-react';

export function TaxRemittanceActions({ remittanceId }: { remittanceId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const action = async (name: 'approve' | 'reject') => {
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/accountant/taxes/${remittanceId}/${name}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        ...(name === 'reject' ? { body: JSON.stringify({ reason: 'Rejected from tax control register; review filing evidence.' }) } : {}),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error || `Unable to ${name} remittance`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return <div className="flex justify-end gap-1"><button disabled={busy} onClick={() => void action('approve')} title="Approve remittance" className="rounded-lg p-1.5 text-emerald-300 hover:bg-emerald-400/10 disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}</button><button disabled={busy} onClick={() => void action('reject')} title="Reject remittance" className="rounded-lg p-1.5 text-rose-300 hover:bg-rose-400/10 disabled:opacity-50"><X className="h-3.5 w-3.5" /></button></div>;
}
