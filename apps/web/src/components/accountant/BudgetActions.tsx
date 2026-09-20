"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, Send } from 'lucide-react';

export function BudgetActions({ budgetId, status, canApprove }: { budgetId: string; status: string; canApprove: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const action = status === 'DRAFT' ? 'submit' : status === 'SUBMITTED' && canApprove ? 'approve' : null;
  if (!action) return null;

  async function run() {
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/accountant/budgets/${budgetId}/${action}`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Unable to ${action} budget`);
      toast.success(action === 'submit' ? 'Budget submitted for approval' : 'Budget approved');
      router.refresh();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Budget action failed');
    } finally {
      setBusy(false);
    }
  }

  return <button onClick={run} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-400/20 disabled:opacity-50">
    {action === 'submit' ? <Send className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
    {busy ? 'Working…' : action === 'submit' ? 'Submit' : 'Approve'}
  </button>;
}
