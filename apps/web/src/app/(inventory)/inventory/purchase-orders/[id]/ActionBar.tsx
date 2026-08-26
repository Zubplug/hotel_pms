'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, XCircle, FileInput, Send } from 'lucide-react';

export function POActionBar({ id, status, canApprove }: { id: string, status: string, canApprove: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAction(action: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/inventory/purchase-orders/${id}/${action}`, {
        method: 'POST'
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
      <button onClick={() => handleAction('submit')} disabled={loading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-slate-900 px-4 py-2 rounded-md transition-colors text-sm font-medium disabled:opacity-50">
        <Send className="w-4 h-4" /> Submit for Approval
      </button>
    );
  }

  if (status === 'SUBMITTED' && canApprove) {
    return (
      <div className="flex gap-3">
        <button onClick={() => handleAction('reject')} disabled={loading} className="flex items-center gap-2 bg-red-600/10 hover:bg-red-600/20 text-red-500 px-4 py-2 rounded-md transition-colors text-sm font-medium disabled:opacity-50">
          <XCircle className="w-4 h-4" /> Reject
        </button>
        <button onClick={() => handleAction('approve')} disabled={loading} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-slate-900 px-4 py-2 rounded-md transition-colors text-sm font-medium disabled:opacity-50">
          <CheckCircle2 className="w-4 h-4" /> Approve
        </button>
      </div>
    );
  }

  if (status === 'APPROVED' || status === 'PARTIALLY_RECEIVED') {
    return (
      <button onClick={() => router.push(`/inventory/grns/new?poId=${id}`)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-slate-900 px-4 py-2 rounded-md transition-colors text-sm font-medium">
        <FileInput className="w-4 h-4" /> Create GRN
      </button>
    );
  }

  return null;
}
