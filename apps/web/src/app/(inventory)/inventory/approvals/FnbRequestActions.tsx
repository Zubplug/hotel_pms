'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Loader2, Send, XCircle } from 'lucide-react';

export default function FnbRequestActions({ transferId, status }: { transferId: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function call(endpoint: string, label: string, body: Record<string, unknown> = {}) {
    setBusy(label);
    setError('');
    try {
      const response = await fetch(`/api/v1/inventory/transfers/${transferId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || result.error) throw new Error(result.error || 'Request action failed');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Request action failed');
    } finally {
      setBusy(null);
    }
  }

  async function approveAndIssue() {
    setBusy('Approve & issue');
    setError('');
    try {
      const approval = await fetch(`/api/v1/inventory/transfers/${transferId}/approve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
      });
      const approvalResult = await approval.json();
      if (!approval.ok || approvalResult.error) throw new Error(approvalResult.error || 'Approval failed');

      const issue = await fetch(`/api/v1/inventory/transfers/${transferId}/post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationId: crypto.randomUUID() }),
      });
      const issueResult = await issue.json();
      if (!issue.ok || issueResult.error) throw new Error(issueResult.error || 'Issuing stock failed');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not approve and issue request');
    } finally {
      setBusy(null);
    }
  }

  if (status === 'PENDING_APPROVAL') {
    return <div className="flex flex-wrap justify-end gap-2">
      <button disabled={!!busy} onClick={() => { const reason = window.prompt('Reason for rejecting this request:')?.trim(); if (reason) void call('reject', 'Reject', { reason }); }} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/25 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-400/10 disabled:opacity-50"><XCircle className="h-3.5 w-3.5" />Reject</button>
      <button disabled={!!busy} onClick={() => void approveAndIssue()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">{busy === 'Approve & issue' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Approve & issue</button>
      {error && <span className="basis-full text-right text-[11px] text-rose-300">{error}</span>}
    </div>;
  }

  if (status === 'APPROVED') {
    return <div className="flex flex-wrap justify-end gap-2">
      <button disabled={!!busy} onClick={() => { const reason = window.prompt('Reason for rejecting this approved request:')?.trim(); if (reason) void call('reject', 'Reject', { reason }); }} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/25 px-3 py-2 text-xs font-semibold text-rose-200 hover:bg-rose-400/10 disabled:opacity-50"><XCircle className="h-3.5 w-3.5" />Reject</button>
      <button disabled={!!busy} onClick={() => void call('post', 'Issue', { operationId: crypto.randomUUID() })} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/25 bg-violet-400/10 px-3 py-2 text-xs font-semibold text-violet-200 hover:bg-violet-400/20 disabled:opacity-50">{busy === 'Issue' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Issue stock</button>
      {error && <span className="basis-full text-right text-[11px] text-rose-300">{error}</span>}
    </div>;
  }

  if (status === 'COMPLETED' || status === 'RECEIVED') return <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Completed</span>;
  return <span className="text-xs text-slate-600">No action</span>;
}
