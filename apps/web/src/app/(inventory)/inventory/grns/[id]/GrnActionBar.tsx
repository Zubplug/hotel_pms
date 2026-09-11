'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, AlertTriangle, Loader2, Send, CheckCircle, XCircle } from 'lucide-react';

type Props = {
  id: string;
  status: string;
  itemCount: number;
  warehouseName: string;
  canReceive: boolean;
  canApprove: boolean;
  canPost: boolean;
};

export function GrnActionBar({ id, status, itemCount, warehouseName, canReceive, canApprove, canPost }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [modalType, setModalType] = useState<'SUBMIT' | 'APPROVE' | 'REJECT' | 'POST' | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  async function handleAction(actionUrl: string, body?: any) {
    setLoading(true);
    try {
      const res = await fetch(actionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      const data = await res.json();
      if (res.ok) {
        setModalType(null);
        router.refresh();
      } else {
        alert(data.error || `Failed to perform action`);
      }
    } catch (e) {
      console.error(e);
      alert('An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'POSTED') return null;
  if (status === 'CANCELLED') return null;

  return (
    <div className="flex items-center gap-3 w-full">
      {status === 'DRAFT' && canReceive && (
        <button
          onClick={() => setModalType('SUBMIT')}
          className="flex-1 flex justify-center items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 text-sm font-medium"
        >
          <Send className="w-4 h-4" />
          Submit for Approval
        </button>
      )}

      {status === 'SUBMITTED' && canApprove && (
        <>
          <button
            onClick={() => setModalType('REJECT')}
            className="flex-1 flex justify-center items-center gap-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 hover:border-red-300 px-5 py-2.5 rounded-xl transition-all shadow-sm text-sm font-medium"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
          <button
            onClick={() => setModalType('APPROVE')}
            className="flex-1 flex justify-center items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 text-sm font-medium"
          >
            <CheckCircle className="w-4 h-4" />
            Approve GRN
          </button>
        </>
      )}

      {status === 'APPROVED' && canPost && (
        <button
          onClick={() => setModalType('POST')}
          className="flex-1 flex justify-center items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 text-sm font-medium"
        >
          <Archive className="w-4 h-4" />
          Post to Stock
        </button>
      )}

      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200/60 max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            {modalType === 'POST' ? (
              <>
                <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-4">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Post GRN to Stock?</h3>
                <p className="text-slate-600 mb-6">
                  This will add items across <span className="font-semibold">{itemCount} product{itemCount !== 1 && 's'}</span> to <span className="font-semibold">{warehouseName}</span> inventory and update the Purchase Order. <br/><br/>
                  <strong className="text-slate-900">This action is transactional and cannot be undone directly.</strong>
                </p>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => setModalType(null)} disabled={loading} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50">Cancel</button>
                  <button onClick={() => handleAction(`/api/v1/inventory/grns/${id}/post`, { operationId: crypto.randomUUID() })} disabled={loading} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm & Post'}
                  </button>
                </div>
              </>
            ) : modalType === 'REJECT' ? (
              <>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Reject GRN</h3>
                <p className="text-slate-600 mb-4">Please provide a reason for rejecting this Goods Receipt Note.</p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-xl mb-4 text-slate-900 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="E.g. Quantities do not match the delivery note..."
                  rows={3}
                />
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => setModalType(null)} disabled={loading} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50">Cancel</button>
                  <button onClick={() => handleAction(`/api/v1/inventory/grns/${id}/reject`, { reason: rejectReason })} disabled={loading || !rejectReason.trim()} className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Reject GRN'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-xl font-bold text-slate-900 mb-2">
                  {modalType === 'SUBMIT' ? 'Submit for Approval?' : 'Approve GRN?'}
                </h3>
                <p className="text-slate-600 mb-6">
                  {modalType === 'SUBMIT' ? 'This will send the GRN to a manager for review. You can no longer edit the quantities after submission.' : 'This verifies the received quantities are correct. The GRN will then be ready for posting to stock.'}
                </p>
                <div className="flex items-center justify-end gap-3">
                  <button onClick={() => setModalType(null)} disabled={loading} className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50">Cancel</button>
                  <button onClick={() => handleAction(`/api/v1/inventory/grns/${id}/${modalType.toLowerCase()}`)} disabled={loading} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium shadow-sm transition-colors disabled:opacity-50">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirm'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
