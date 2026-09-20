"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { CheckCircle2, CreditCard, Play } from 'lucide-react';

export function PayrollPeriodActions({ id, status, canApprove }: { id: string; status: string; canApprove: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const action = status === 'DRAFT' ? 'process' : status === 'PROCESSING' && canApprove ? 'approve' : status === 'APPROVED' && canApprove ? 'pay' : null;
  if (!action) return <span className="text-xs text-slate-600">No action</span>;
  const labels = { process: 'Calculate', approve: 'Approve', pay: 'Mark paid' };
  const icons = { process: Play, approve: CheckCircle2, pay: CreditCard };
  const Icon = icons[action];
  async function run() {
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/accountant/payroll/periods/${id}/${action}`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || `Unable to ${action} payroll`);
      toast.success(action === 'process' ? 'Payslips calculated' : action === 'approve' ? 'Payroll approved' : 'Payroll marked paid');
      router.refresh();
    } catch (error: unknown) { toast.error(error instanceof Error ? error.message : 'Payroll action failed'); }
    finally { setBusy(false); }
  }
  return <button onClick={run} disabled={busy} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/20 disabled:opacity-50"><Icon className="h-3.5 w-3.5" />{busy ? 'Working…' : labels[action]}</button>;
}
