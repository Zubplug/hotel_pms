'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowUpRight, Check, CheckCircle2, ClipboardCheck, Clock3, FileText, Loader2, RefreshCw, ShieldCheck, WalletCards, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

type ApprovalRequest = {
  id: string;
  property?: { name?: string | null };
  type: string;
  amount?: number | string | null;
  currency?: string | null;
  reason: string;
  details?: Record<string, any> | null;
  snapshot?: Record<string, any> | null;
  requestedBy?: string | null;
  requestedAt: string;
};

type ExpenseLine = { description: string; unit?: string | null; quantity: number | string; unitPrice: number | string; total: number | string };
type ExpenseApproval = { id: string; expenseReference: string; currentApprovalStage?: string | null; amount: number | string; currency: string; category: string; description: string; payee: string; createdAt?: string; lineItems?: ExpenseLine[] };
type QueueRow = { kind: 'REQUEST'; value: ApprovalRequest } | { kind: 'EXPENSE'; value: ExpenseApproval };

const labelFor = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
const formatMoney = (value: unknown, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(Number(value || 0));

function requestTitle(request: ApprovalRequest) {
  const details = request.details || {};
  return String(details.productName || details.name || details.reference || labelFor(request.type));
}

function requestSubtitle(request: ApprovalRequest) {
  const details = request.details || {};
  if (request.type.startsWith('POS_')) return String(details.productName || details.name || 'POS catalogue request');
  if (request.type === 'REFUND') return 'Refund request';
  if (request.type === 'STOCK_TRANSFER') return details.isOutletBound ? 'Outlet transfer request' : 'Warehouse transfer request';
  return labelFor(request.type);
}

function requestTypeLabel(request: ApprovalRequest) {
  if (request.type === 'STOCK_TRANSFER') return 'Stock transfer';
  if (request.type.startsWith('POS_')) return 'F&B catalogue';
  return labelFor(request.type);
}

export default function GeneralManagerApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [expenses, setExpenses] = useState<ExpenseApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<ExpenseApproval | null>(null);
  const [selectedDiscount, setSelectedDiscount] = useState<ApprovalRequest | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [requestResponse, expenseResponse] = await Promise.all([
        fetch('/api/mobile/v1/executive/approvals?propertyId=ALL_AUTHORIZED', { cache: 'no-store' }),
        fetch('/api/v1/financial-control/expenses', { cache: 'no-store' }),
      ]);
      const requestBody = await requestResponse.json();
      const expenseBody = await expenseResponse.json();
      if (!requestResponse.ok) throw new Error(requestBody.error?.message || 'Unable to load approval requests');
      if (!expenseResponse.ok) throw new Error(expenseBody.error || 'Unable to load expense approvals');
      setRequests(requestBody.data || []);
      setExpenses((expenseBody.data || []).filter((expense: ExpenseApproval) => expense.currentApprovalStage === 'GENERAL_MANAGER'));
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Unable to load approval queues', error: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decideRequest = async (request: ApprovalRequest, action: 'approve' | 'reject') => {
    const comment = action === 'reject' ? window.prompt('Add a reason for rejecting this request:')?.trim() : '';
    if (action === 'reject' && !comment) return;
    setBusyId(request.id);
    setMessage(null);
    try {
      let endpoint = `/api/manager/approvals/${request.id}/${action}`;
      let successMessage = action === 'approve' ? 'Request approved successfully.' : 'Request rejected successfully.';
      if (request.type === 'STOCK_TRANSFER') {
        if (action === 'approve') {
          if (request.details?.originalStatus === 'ISSUED') {
            endpoint = `/api/v1/inventory/transfers/${request.id}/receive`;
            successMessage = 'Transfer receipt confirmed successfully.';
          } else endpoint = `/api/v1/inventory/transfers/${request.id}/approve`;
        } else endpoint = `/api/v1/inventory/transfers/${request.id}/reject`;
      }
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(action === 'reject' ? { comment, reason: comment } : {}) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || body.error || 'Unable to process approval');
      if (request.type === 'DISCOUNT') setSelectedDiscount(null);
      setMessage({ text: successMessage });
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Unable to process approval', error: true });
    } finally {
      setBusyId(null);
    }
  };

  const decideExpense = async (expense: ExpenseApproval, action: 'approve' | 'reject') => {
    const reason = action === 'reject' ? window.prompt('Reason for rejecting this invoice:')?.trim() : undefined;
    if (action === 'reject' && !reason) return;
    setBusyId(expense.id);
    setMessage(null);
    try {
      const response = await fetch(`/api/v1/financial-control/expenses/${expense.id}/action`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ...(reason ? { reason } : {}) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to update expense invoice');
      setSelectedExpense(null);
      setMessage({ text: action === 'approve' ? 'Expense invoice approved successfully.' : 'Expense invoice rejected successfully.' });
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Unable to update expense invoice', error: true });
    } finally {
      setBusyId(null);
    }
  };

  const rows: QueueRow[] = [...requests.map((value) => ({ kind: 'REQUEST' as const, value })), ...expenses.map((value) => ({ kind: 'EXPENSE' as const, value }))];
  const operationalCount = requests.length + expenses.length;
  const inventoryCount = requests.filter((request) => request.type === 'STOCK_TRANSFER').length;

  return (
    <main className="min-h-full bg-[#07111f] px-4 py-6 text-slate-200 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1480px] space-y-6 pb-10">
        <header className="relative overflow-hidden rounded-3xl border border-white/[.08] bg-gradient-to-br from-[#142746] via-[#101a2d] to-[#09111f] p-6 shadow-2xl sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.22em] text-cyan-300"><ShieldCheck className="h-4 w-4" />Executive control</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">Approval Control Centre</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">One controlled workspace for operational, financial, inventory, refund, discount, F&amp;B, and expense decisions across your authorised properties.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading} className="border-white/10 bg-white/[.05] text-white hover:bg-white/[.1] hover:text-white"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh queue</Button></div>
          <div className="relative mt-7 grid gap-3 sm:grid-cols-3"><Metric label="Awaiting my action" value={String(operationalCount)} icon={Clock3} /><Metric label="Operational requests" value={String(requests.length)} icon={ClipboardCheck} /><Metric label="Inventory controls" value={String(inventoryCount)} icon={WalletCards} /></div>
        </header>

        {message && <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${message.error ? 'border-rose-400/20 bg-rose-400/[.08] text-rose-200' : 'border-emerald-400/20 bg-emerald-400/[.08] text-emerald-200'}`}><AlertCircle className="h-4 w-4" />{message.text}</div>}

          <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#101a2d]/90 shadow-xl"><div className="flex items-center justify-between gap-4 border-b border-white/[.07] p-5"><div><h2 className="font-semibold text-white">Approval register</h2><p className="mt-1 text-xs text-slate-500">{rows.length} request{rows.length === 1 ? '' : 's'} awaiting General Manager action</p></div><Badge variant="outline" className="border-amber-300/20 bg-amber-300/[.08] px-3 py-1 text-amber-200">{rows.length} pending</Badge></div>
          {loading ? <div className="p-16 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-cyan-300" />Loading approval queue…</div> : !rows.length ? <div className="p-16 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-300" /><p className="mt-3 font-medium text-white">Approval queue is clear</p><p className="mt-1 text-sm text-slate-500">No requests or expense invoices are awaiting manager action.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[1040px] text-sm"><thead className="bg-slate-950/30 text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="px-5 py-3 text-left">Request</th><th className="px-5 py-3 text-left">Amount / value</th><th className="px-5 py-3 text-left">Workflow</th><th className="px-5 py-3 text-left">Submitted</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-white/[.07]">{rows.map((row) => { const isExpense = row.kind === 'EXPENSE'; const value = row.value as any; const busy = busyId === value.id; const title = isExpense ? value.payee : requestTitle(value); const subtitle = isExpense ? `${value.expenseReference} · ${value.category}` : `${requestSubtitle(value)} · ${value.property?.name || 'Authorised property'}`; const amount = isExpense ? formatMoney(value.amount, value.currency || 'NGN') : value.amount == null ? '—' : formatMoney(value.amount, value.currency || 'NGN'); return <tr key={`${row.kind}-${value.id}`} className="transition hover:bg-white/[.025]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isExpense ? 'bg-violet-400/10 text-violet-300' : 'bg-cyan-400/10 text-cyan-300'}`}>{isExpense ? <FileText className="h-4 w-4" /> : <ClipboardCheck className="h-4 w-4" />}</span><div><p className="font-medium text-slate-200">{title}</p><p className="mt-1 max-w-[360px] truncate text-xs text-slate-500">{subtitle}</p></div></div></td><td className="px-5 py-4 font-semibold text-white">{amount}</td><td className="px-5 py-4"><Badge variant="outline" className="border-white/10 bg-white/[.03] text-slate-300">{isExpense ? 'Expense invoice' : requestTypeLabel(value)}</Badge><p className="mt-1 max-w-[230px] truncate text-xs text-slate-500">{isExpense ? value.description : value.reason || 'No reason supplied'}</p></td><td className="px-5 py-4 text-xs text-slate-500">{new Date(isExpense ? value.createdAt || Date.now() : value.requestedAt).toLocaleString()}</td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2">{isExpense && <Button size="sm" variant="outline" disabled={busy} onClick={() => setSelectedExpense(value)} className="border-white/10 bg-transparent text-slate-200 hover:bg-white/[.08]"><FileText className="mr-1.5 h-3.5 w-3.5" />View invoice</Button>}{!isExpense && value.type === 'DISCOUNT' && <Button size="sm" variant="outline" disabled={busy} onClick={() => setSelectedDiscount(value)} className="border-cyan-400/20 bg-transparent text-cyan-200 hover:bg-cyan-400/[.08]"><FileText className="mr-1.5 h-3.5 w-3.5" />Review details</Button>}<Button size="sm" variant="outline" disabled={busy} onClick={() => void (isExpense ? decideExpense(value, 'reject') : decideRequest(value, 'reject'))} className="border-rose-400/20 bg-transparent text-slate-200 hover:bg-white/[.08]"><X className="mr-1.5 h-3.5 w-3.5" />Reject</Button><Button size="sm" disabled={busy} onClick={() => void (isExpense ? decideExpense(value, 'approve') : decideRequest(value, 'approve'))} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">{busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}Approve</Button><ArrowUpRight className="ml-1 self-center text-slate-600" /></div></td></tr>; })}</tbody></table></div>}
        </section>

        <ExpenseInvoiceDialog expense={selectedExpense} busy={selectedExpense ? busyId === selectedExpense.id : false} onClose={() => setSelectedExpense(null)} onAction={(action) => selectedExpense ? void decideExpense(selectedExpense, action) : undefined} />
        <DiscountReviewDialog discount={selectedDiscount} busy={selectedDiscount ? busyId === selectedDiscount.id : false} onClose={() => setSelectedDiscount(null)} onAction={(action) => selectedDiscount ? void decideRequest(selectedDiscount, action) : undefined} />
      </div>
    </main>
  );
}

function DiscountReviewDialog({ discount, busy, onClose, onAction }: { discount: ApprovalRequest | null; busy: boolean; onClose: () => void; onAction: (action: 'approve' | 'reject') => void }) {
  const details = discount?.details || {};
  const snapshot = discount?.snapshot || {};
  const review = details.review || {};
  const reservation = review.reservation || {};
  const guest = reservation.primaryGuest || {};
  const room = review.room || {};
  const originalRate = Number(snapshot.originalRate ?? review.rateAmount ?? 0);
  const discountValue = snapshot.discountType === 'PERCENTAGE' ? originalRate * Number(snapshot.discountPercent || 0) / 100 : Number(snapshot.discountAmount || discount?.amount || 0);
  const currency = review.currency || discount?.currency || 'NGN';
  return <Dialog open={Boolean(discount)} onOpenChange={(open) => !open && !busy && onClose()}><DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-white/10 bg-[#101a2d] text-slate-100 sm:max-w-4xl"><DialogHeader><DialogTitle className="text-white">Discount approval review</DialogTitle><DialogDescription className="text-slate-400">Review the complete reservation, guest, room, rate, and discount context.</DialogDescription></DialogHeader>{discount && <div className="space-y-4"><ReviewGrid items={[["Confirmation", reservation.confirmationNumber], ["Guest", `${guest.firstName || ''} ${guest.lastName || ''}`.trim() || '—'], ["Room", `${room.number || room.name || 'Unassigned'} · ${room.roomType?.name || 'Room type unavailable'}`], ["Guest contact", guest.email || guest.phone || 'Not supplied'], ["Check-in", review.checkIn ? new Date(review.checkIn).toLocaleDateString() : '—'], ["Check-out", review.checkOut ? new Date(review.checkOut).toLocaleDateString() : '—'], ["Guests", `${review.adults || reservation.adults || 0} adults · ${review.children || reservation.children || 0} children`], ["Reservation status", reservation.status || review.status || '—']]} /><div className="grid gap-3 rounded-xl border border-cyan-400/20 bg-cyan-400/[.05] p-4 sm:grid-cols-4"><ReviewValue label="Original rate" value={formatMoney(originalRate, currency)} /><ReviewValue label="Discount type" value={String(snapshot.discountType || '—')} /><ReviewValue label="Discount value" value={formatMoney(discountValue, currency)} /><ReviewValue label="Net room rate" value={formatMoney(Math.max(0, originalRate - discountValue), currency)} /></div><div className="rounded-xl border border-white/10 bg-white/[.03] p-4"><p className="text-xs uppercase tracking-[.14em] text-slate-500">Reason and audit context</p><p className="mt-2 text-sm leading-6 text-slate-200">{discount.reason || snapshot.reason || 'No reason supplied'}</p><ReviewGrid items={[["Requested by", discount.requestedBy || '—'], ["Acknowledged staff", details.acknowledgedByStaffId || '—'], ["Source", reservation.source || details.source || '—'], ["Special requests", reservation.specialRequests || 'None']]} /></div></div>}<DialogFooter><Button variant="outline" onClick={onClose} disabled={busy} className="border-white/10 bg-transparent text-slate-200">Close</Button><Button variant="destructive" disabled={!discount || busy} onClick={() => onAction('reject')}>Reject</Button><Button disabled={!discount || busy} onClick={() => onAction('approve')} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">{busy ? 'Recording…' : 'Approve discount'}</Button></DialogFooter></DialogContent></Dialog>;
}

function ReviewGrid({ items }: { items: Array<[string, unknown]> }) {
  return <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map(([label, value]) => <div key={label}><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words text-sm text-slate-200">{String(value || '—')}</p></div>)}</div>;
}

function ReviewValue({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className="mt-1 font-semibold text-white">{value}</p></div>;
}

function ExpenseInvoiceDialog({ expense, busy, onClose, onAction }: { expense: ExpenseApproval | null; busy: boolean; onClose: () => void; onAction: (action: 'approve' | 'reject') => void }) {
  return <Dialog open={Boolean(expense)} onOpenChange={(open) => !open && !busy && onClose()}><DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto border-white/10 bg-[#101a2d] text-slate-100 sm:max-w-3xl"><DialogHeader><DialogTitle className="text-white">Expense invoice {expense?.expenseReference}</DialogTitle><DialogDescription className="text-slate-400">Review the complete line-item requisition before approving.</DialogDescription></DialogHeader>{expense && <div className="space-y-4"><div className="grid gap-3 rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm sm:grid-cols-3"><div><p className="text-xs text-slate-500">Payee</p><p className="mt-1 font-semibold text-white">{expense.payee}</p></div><div><p className="text-xs text-slate-500">Category</p><p className="mt-1 text-slate-300">{expense.category}</p></div><div><p className="text-xs text-slate-500">Total</p><p className="mt-1 font-bold text-white">{formatMoney(expense.amount, expense.currency || 'NGN')}</p></div></div><p className="text-sm text-slate-300">{expense.description}</p><div className="overflow-hidden rounded-xl border border-white/10"><div className="grid grid-cols-[1fr_70px_110px_110px] gap-2 bg-white/[.04] px-4 py-2 text-xs font-semibold text-slate-400"><span>Item / service</span><span>Qty</span><span>Unit price</span><span className="text-right">Total</span></div>{(expense.lineItems || []).map((line, index) => <div key={`${line.description}-${index}`} className="grid grid-cols-[1fr_70px_110px_110px] gap-2 border-t border-white/10 px-4 py-3 text-sm"><span className="text-slate-200">{line.description}{line.unit ? ` · ${line.unit}` : ''}</span><span className="text-slate-300">{line.quantity}</span><span className="text-slate-300">{formatMoney(line.unitPrice, expense.currency || 'NGN')}</span><span className="text-right font-semibold text-white">{formatMoney(line.total, expense.currency || 'NGN')}</span></div>)}<div className="flex justify-between border-t border-white/10 bg-white/[.04] px-4 py-3 font-bold text-white"><span>Invoice total</span><span>{formatMoney(expense.amount, expense.currency || 'NGN')}</span></div></div></div>}<DialogFooter><Button variant="outline" onClick={onClose} disabled={busy} className="border-white/10 bg-transparent text-slate-200">Close</Button><Button variant="destructive" disabled={!expense || busy} onClick={() => onAction('reject')}>Reject</Button><Button disabled={!expense || busy} onClick={() => onAction('approve')} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">{busy ? 'Recording…' : 'Approve invoice'}</Button></DialogFooter></DialogContent></Dialog>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.06] p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p><Icon className="h-4 w-4 text-cyan-300" /></div><p className="mt-2 text-2xl font-black text-white">{value}</p></div>;
}
