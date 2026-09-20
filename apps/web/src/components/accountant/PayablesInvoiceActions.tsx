'use client';

import { useState } from 'react';
import { Check, FileWarning, Loader2, MessageSquare, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SchedulePaymentDialog } from '@/components/accountant/SchedulePaymentDialog';

export function PayablesInvoiceActions({ invoiceId, status, amount, currency }: { invoiceId: string; status: string; amount: number; currency: string }) {
  const [busy, setBusy] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState('');

  async function approve() {
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/accountant/payables/${invoiceId}/approve`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to approve invoice');
      toast.success('Invoice approved for payment');
      window.location.reload();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to approve invoice'); }
    finally { setBusy(false); }
  }

  async function dispute() {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/accountant/payables/${invoiceId}/dispute`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: reason.trim() }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to dispute invoice');
      toast.success('Invoice moved to dispute review');
      setDisputeOpen(false);
      window.location.reload();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to dispute invoice'); }
    finally { setBusy(false); }
  }

  return <div className="flex flex-wrap items-center justify-end gap-2">
    {(status === 'RECEIVED' || status === 'UNDER_REVIEW') && <Button size="sm" onClick={approve} disabled={busy} className="h-8 bg-emerald-500 text-xs text-slate-950 hover:bg-emerald-400"><Check className="mr-1 h-3.5 w-3.5" />Approve</Button>}
    {(status === 'RECEIVED' || status === 'UNDER_REVIEW' || status === 'APPROVED' || status === 'PARTIAL') && <SchedulePaymentDialog invoiceId={invoiceId} amount={amount} currency={currency} />}
    {!['PAID', 'CANCELLED', 'DISPUTED'].includes(status) && <Button size="sm" variant="outline" onClick={() => setDisputeOpen(true)} disabled={busy} className="h-8 border-white/10 bg-transparent text-xs text-slate-300 hover:bg-rose-400/10 hover:text-rose-200"><ShieldAlert className="mr-1 h-3.5 w-3.5" />Dispute</Button>}
    {busy && <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />}
    <Dialog open={disputeOpen} onOpenChange={open => !busy && setDisputeOpen(open)}><DialogContent className="border-white/10 bg-[#0b1628] text-slate-100"><DialogHeader><DialogTitle>Dispute supplier invoice</DialogTitle><DialogDescription className="text-slate-400">Record the control reason. The invoice will leave the payment queue until resolved.</DialogDescription></DialogHeader><textarea value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain the discrepancy, missing receipt, or approval exception…" className="min-h-28 w-full rounded-xl border border-white/10 bg-white/[.04] p-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-rose-400/50" /><DialogFooter><Button variant="ghost" onClick={() => setDisputeOpen(false)} disabled={busy}>Cancel</Button><Button onClick={dispute} disabled={busy || !reason.trim()} className="bg-rose-500 text-white hover:bg-rose-400"><FileWarning className="mr-2 h-4 w-4" />Record dispute</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}
