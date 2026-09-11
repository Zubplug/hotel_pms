'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle, XCircle, Send, Loader2, PackageCheck } from 'lucide-react';

interface Props {
  transferId: string;
  status: string;
  canApprove: boolean;
}

export default function TransferActionBar({ transferId, status, canApprove }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function callAction(endpoint: string, label: string, body?: object) {
    setLoading(label);
    setError('');
    try {
      const res = await fetch(`/api/v1/inventory/transfers/${transferId}/${endpoint}`, {
        method: endpoint === 'post' ? 'POST' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Action failed');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  }

  const btn = (label: string, icon: React.ReactNode, onClick: () => void, style: string) => (
    <button
      onClick={onClick}
      disabled={!!loading}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${style}`}
    >
      {loading === label ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {loading === label ? 'Processing...' : label}
    </button>
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        {status === 'DRAFT' && btn('Submit for Approval', <Send className="w-4 h-4" />,
          () => callAction('submit', 'Submit for Approval'),
          'bg-blue-600 hover:bg-blue-500 text-slate-900'
        )}

        {status === 'PENDING_APPROVAL' && canApprove && (
          <>
            {btn('Approve', <CheckCircle className="w-4 h-4" />,
              () => callAction('approve', 'Approve'),
              'bg-green-600 hover:bg-green-500 text-slate-900'
            )}
          </>
        )}

        {status === 'APPROVED' && canApprove && btn('Post to Stock', <PackageCheck className="w-4 h-4" />,
          () => callAction('post', 'Post to Stock', { operationId: crypto.randomUUID() }),
          'bg-teal-600 hover:bg-teal-500 text-slate-900'
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-red-600 text-xs">
          <XCircle className="w-3.5 h-3.5" /> {error}
        </div>
      )}
    </div>
  );
}
