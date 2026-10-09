'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, FileInput, Send } from 'lucide-react';

export function POActionBar({ id, status, approvalStage, canApprove }: { id: string, status: string, approvalStage?: string | null, canApprove: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: string) {
    const reason = action === 'reject' ? window.prompt('Reason for rejecting this purchase order:')?.trim() : undefined;
    if (action === 'reject' && !reason) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/inventory/purchase-orders/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ reason }) : undefined,
      });
      if (res.ok) {
        router.refresh();
      } else {
        alert(`Action ${action} failed`);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  if (status === 'DRAFT') {
    return (
      <button onClick={() => handleAction('submit')} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/25 disabled:opacity-50">
        <Send className="w-4 h-4" /> Submit for Approval
      </button>
    );
  }

  if (status === 'SUBMITTED' && canApprove) {
    return (
      <div className="flex flex-wrap gap-2">
        <button onClick={() => handleAction('reject')} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-2.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-400/20 disabled:opacity-50">
          <XCircle className="w-4 h-4" /> Reject
        </button>
        <button onClick={() => handleAction('approve')} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-[#07111f] transition hover:bg-emerald-300 disabled:opacity-50">
          <CheckCircle2 className="w-4 h-4" /> {approvalStage === 'ACCOUNTANT' ? 'Approve as Accountant' : 'Final approval'}
        </button>
      </div>
    );
  }

  if (status === 'APPROVED' || status === 'PARTIALLY_RECEIVED') {
    return (
      <button onClick={() => router.push(`/inventory/grns/new?poId=${id}`)} className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/15 px-4 py-2.5 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/25">
        <FileInput className="w-4 h-4" /> Create GRN
      </button>
    );
  }

  return null;
}
