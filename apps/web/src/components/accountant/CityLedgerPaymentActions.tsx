'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowRightLeft, RotateCcw, Unlink } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Invoice = { id: string; invoiceNumber: string; outstandingAmount: number; currency: string };
type Account = { id: string; name: string; type: string };
type Allocation = { id: string; amount: number; invoice?: { invoiceNumber: string } | null };

export function CityLedgerPaymentActions({ accountId, paymentId, amount, currency, invoices, accounts, allocations, status, accountType, canManagerCorrect, onComplete }: { accountId: string; paymentId: string; amount: number; currency: string; invoices: Invoice[]; accounts: Account[]; allocations: Allocation[]; status: string; accountType: string; canManagerCorrect: boolean; onComplete?: () => void }) {
  const [action, setAction] = useState<'allocate' | 'transfer' | 'reverse' | 'unapply' | null>(null);
  const [invoiceId, setInvoiceId] = useState('');
  const [targetAccountId, setTargetAccountId] = useState('');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [selectedAllocation, setSelectedAllocation] = useState<Allocation | null>(null);
  const [busy, setBusy] = useState(false);
  const available = Math.max(0, amount - allocations.reduce((sum, allocation) => sum + Number(allocation.amount), 0));
  const canManage = status !== 'REVERSED';
  const isCorporate = accountType === 'CORPORATE';

  const submit = async () => {
    if (!action) return;
    if ((action === 'reverse' || action === 'transfer' || action === 'unapply') && reason.trim().length < 3) return toast.error('Enter a clear audit reason.');
    if (!window.confirm(`Confirm ${action} for this payment? This action will be recorded in the audit trail.`)) return;
    const base = `/api/v1/accountant/city-ledger/${accountId}/payment/${paymentId}`;
    const endpoint = action === 'unapply' ? `${base}/unapply` : `${base}/${action}`;
    const body = action === 'allocate' ? { invoiceId, amount: Number(value) } : action === 'transfer' ? { targetAccountId, reason } : action === 'reverse' ? { reason } : { allocationId: selectedAllocation?.id, reason };
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error?.message || 'Action failed');
      toast.success(action === 'reverse' ? 'Payment reversed with GL audit trail' : action === 'transfer' ? 'Payment transferred' : action === 'unapply' ? 'Payment unapplied' : 'Payment allocated');
      setAction(null); setInvoiceId(''); setTargetAccountId(''); setValue(''); setReason(''); setSelectedAllocation(null); 
      if (onComplete) { onComplete(); } else { window.location.reload(); }
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Action failed'); } finally { setBusy(false); }
  };

  return <>
    <div className="flex flex-wrap justify-end gap-2">
      {isCorporate && canManage && available > 0.01 && <Button size="sm" variant="outline" className="border-cyan-300/20 bg-transparent text-cyan-300" onClick={() => { setAction('allocate'); setValue(String(Math.min(available, invoices[0]?.outstandingAmount || available))); }}>{'Allocate'}</Button>}
      {isCorporate && canManage && allocations.length > 0 && <Button size="sm" variant="outline" className="border-amber-300/20 bg-transparent text-amber-300" onClick={() => { setSelectedAllocation(allocations[0]); setAction('unapply'); }}><Unlink className="mr-1 h-3.5 w-3.5" />Unapply</Button>}
      {isCorporate && canManage && canManagerCorrect && allocations.length === 0 && <Button size="sm" variant="outline" className="border-violet-300/20 bg-transparent text-violet-300" onClick={() => setAction('transfer')}><ArrowRightLeft className="mr-1 h-3.5 w-3.5" />Transfer</Button>}
      {isCorporate && canManage && canManagerCorrect && <Button size="sm" variant="outline" className="border-rose-300/20 bg-transparent text-rose-300" onClick={() => setAction('reverse')}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reverse</Button>}
    </div>
    <Dialog open={Boolean(action)} onOpenChange={open => !open && !busy && setAction(null)}><DialogContent className="border-white/10 bg-[#0b1628] text-slate-100"><DialogHeader><DialogTitle className="text-white">{action === 'allocate' ? 'Allocate unapplied payment' : action === 'transfer' ? 'Transfer payment' : action === 'unapply' ? 'Unapply payment' : 'Reverse payment'}</DialogTitle><DialogDescription className="text-slate-400">{action === 'reverse' ? 'This restores the AR balance, reverses invoice allocations, and posts a balanced GL reversal.' : action === 'transfer' ? 'Move an unapplied receipt to the correct city-ledger account. The 1140 AR control balance remains unchanged.' : action === 'unapply' ? 'The invoice balance will be restored and the payment returned to unapplied status.' : `Available to apply: ${available.toLocaleString()} ${currency}`}</DialogDescription></DialogHeader>
      <div className="space-y-4 py-3">
        {action === 'allocate' && <><div className="grid gap-2"><Label className="text-slate-300">Invoice</Label><Select value={invoiceId} onValueChange={value => value && setInvoiceId(value)}><SelectTrigger className="border-white/10 bg-white/[.05] text-slate-100"><SelectValue placeholder="Select invoice" /></SelectTrigger><SelectContent className="border-white/10 bg-slate-900 text-slate-100">{invoices.map(invoice => <SelectItem key={invoice.id} value={invoice.id}>{invoice.invoiceNumber} · {Number(invoice.outstandingAmount).toLocaleString()} {invoice.currency}</SelectItem>)}</SelectContent></Select></div><div className="grid gap-2"><Label className="text-slate-300">Amount</Label><Input type="number" min="0.01" max={available} step="0.01" value={value} onChange={event => setValue(event.target.value)} className="border-white/10 bg-white/[.05] text-white" /></div></>}
        {action === 'transfer' && <div className="grid gap-2"><Label className="text-slate-300">Target account</Label><Select value={targetAccountId} onValueChange={value => value && setTargetAccountId(value)}><SelectTrigger className="border-white/10 bg-white/[.05] text-slate-100"><SelectValue placeholder="Select account" /></SelectTrigger><SelectContent className="border-white/10 bg-slate-900 text-slate-100">{accounts.filter(account => account.id !== accountId).map(account => <SelectItem key={account.id} value={account.id}>{account.name} · {account.type}</SelectItem>)}</SelectContent></Select></div>}
        {action === 'unapply' && <div className="space-y-2">{allocations.map(allocation => <Button key={allocation.id} variant={selectedAllocation?.id === allocation.id ? 'default' : 'outline'} className="w-full justify-between border-white/10" onClick={() => setSelectedAllocation(allocation)}>{allocation.invoice?.invoiceNumber || 'Invoice'}<span>{Number(allocation.amount).toLocaleString()} {currency}</span></Button>)}</div>}
        {action === 'reverse' && <div className="rounded-xl border border-rose-300/20 bg-rose-300/[.06] p-3 text-xs text-rose-100"><AlertTriangle className="mr-1 inline h-4 w-4" />Reversal is permanent and requires a clear audit reason.</div>}
        {(action === 'reverse' || action === 'transfer' || action === 'unapply') && <div className="grid gap-2"><Label className="text-slate-300">Audit reason</Label><Input value={reason} onChange={event => setReason(event.target.value)} placeholder="Explain the correction" className="border-white/10 bg-white/[.05] text-white" /></div>}
      </div><DialogFooter><Button variant="outline" className="border-white/10 bg-transparent text-slate-300" onClick={() => setAction(null)} disabled={busy}>Cancel</Button><Button className="bg-cyan-600 text-white hover:bg-cyan-500" onClick={submit} disabled={busy || (action === 'allocate' && (!invoiceId || Number(value) <= 0)) || (action === 'unapply' && !selectedAllocation)}>{busy ? 'Processing...' : 'Confirm'}</Button></DialogFooter></DialogContent></Dialog>
  </>;
}
