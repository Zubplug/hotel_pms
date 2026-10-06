'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2, Loader2, PackageCheck, Send, Truck, XCircle,
} from 'lucide-react';

interface Props {
  transferId:   string;
  status:       string;
  canApprove:   boolean;
  canIssue:     boolean;
  canReceive:   boolean;
  isOutletBound: boolean;
  isFnbMgr:    boolean;
}

export default function TransferActionBar({ transferId, status, canApprove, canIssue, canReceive, isOutletBound, isFnbMgr }: Props) {
  const router               = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError]    = useState('');

  async function callAction(endpoint: string, label: string, body?: object) {
    setLoading(label);
    setError('');
    try {
      const res  = await fetch(`/api/v1/inventory/transfers/${transferId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : '{}',
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

  function ActionBtn({ label, icon, onClick, tone }: {
    label: string; icon: React.ReactNode; onClick: () => void;
    tone: 'emerald' | 'violet' | 'cyan' | 'amber' | 'rose';
  }) {
    const colours = {
      emerald: 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25',
      violet:  'border-violet-400/30 bg-violet-400/15 text-violet-200 hover:bg-violet-400/25',
      cyan:    'border-cyan-400/30 bg-cyan-400/15 text-cyan-200 hover:bg-cyan-400/25',
      amber:   'border-amber-400/30 bg-amber-400/15 text-amber-200 hover:bg-amber-400/25',
      rose:    'border-rose-400/30 bg-rose-400/15 text-rose-200 hover:bg-rose-400/25',
    }[tone];
    return (
      <button onClick={onClick} disabled={!!loading}
        className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${colours}`}>
        {loading === label ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
        {loading === label ? 'Processing…' : label}
      </button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2 justify-end">

        {/* ── PENDING_APPROVAL ─────────────────────────────────────────── */}
        {status === 'PENDING_APPROVAL' && canApprove && (
          // For outlet-bound: Stock Manager "Approve & Issue" (approve + post in one step)
          <>
            <ActionBtn label="Reject" icon={<XCircle className="h-4 w-4" />} tone="rose"
              onClick={() => {
                const reason = window.prompt('Enter reason for rejecting this transfer:');
                if (reason) callAction('reject', 'Reject', { reason });
              }} />
            {isOutletBound
              ? <ActionBtn label="Approve & Issue" icon={<Send className="h-4 w-4" />} tone="emerald"
                  onClick={() => callAction('approve', 'Approve & Issue').then(() =>
                    callAction('post', 'Approve & Issue', { operationId: crypto.randomUUID() }))} />
              : <ActionBtn label="Approve" icon={<CheckCircle2 className="h-4 w-4" />} tone="cyan"
                  onClick={() => callAction('approve', 'Approve')} />
            }
          </>
        )}

        {/* ── APPROVED → Issue (Stock Manager posts stock) ──────────────── */}
        {status === 'APPROVED' && canIssue && (
          <ActionBtn label="Issue stock" icon={<Truck className="h-4 w-4" />} tone="violet"
            onClick={() => callAction('post', 'Issue stock', { operationId: crypto.randomUUID() })} />
        )}

        {/* ── ISSUED → Receive ──────────────────────────────────────────── */}
        {status === 'ISSUED' && canReceive && (
          <ActionBtn
            label={isFnbMgr ? 'Confirm receipt' : 'Confirm & complete'}
            icon={<PackageCheck className="h-4 w-4" />}
            tone="emerald"
            onClick={() => callAction('receive', isFnbMgr ? 'Confirm receipt' : 'Confirm & complete')}
          />
        )}

        {/* COMPLETED — read-only indicator */}
        {(status === 'COMPLETED' || status === 'RECEIVED') && (
          <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] px-4 py-2.5 text-sm font-semibold text-emerald-300">
            <CheckCircle2 className="h-4 w-4" /> Completed
          </div>
        )}
      </div>

      {/* role hint */}
      {status === 'PENDING_APPROVAL' && !canApprove && (
        <p className="text-[11px] text-slate-600">Awaiting approval by stock management</p>
      )}
      {status === 'ISSUED' && !canReceive && (
        <p className="text-[11px] text-slate-600">Awaiting receipt confirmation</p>
      )}

      {error && (
        <div className="flex items-center gap-2 text-xs text-rose-400">
          <XCircle className="h-3.5 w-3.5" /> {error}
        </div>
      )}
    </div>
  );
}
