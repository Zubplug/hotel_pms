'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock3, FileCheck2, FileText, RefreshCw, Search, ShieldCheck, WalletCards, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type ApprovalCenterProps = { audience: 'ACCOUNTING' | 'CASHIER' | 'MANAGEMENT' };
type Item = { kind: 'EVENT_INVOICE' | 'REFUND' | 'POS' | 'STOCK_TRANSFER' | 'PURCHASE_ORDER' | 'EXPENSE' | 'EMPLOYEE_REIMBURSEMENT' | 'EMPLOYEE_BENEFIT'; value: any };

const money = (value: unknown, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
const label = (value: string) => value.replaceAll('_', ' ');
const fullName = (guest: any) => `${guest?.firstName || ''} ${guest?.lastName || ''}`.trim();
const dateTime = (value: unknown) => value ? new Date(String(value)).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

function eventName(invoice: any) {
  if (invoice.event?.name) return invoice.event.name;
  if (invoice.event?.guest) return fullName(invoice.event.guest) || 'Individual event';
  return invoice.event?.corporateAccount?.name || 'Event invoice';
}

function hasDiscountRequest(invoice: any) {
  return Number(invoice.requestedDiscount || 0) > 0 || (invoice.items || []).some((line: any) => Number(line.requestedDiscount || line.discountAmount || 0) > 0);
}

export function ApprovalControlCenter({ audience }: ApprovalCenterProps) {
  const [data, setData] = useState<any>({ priceApprovals: [], refunds: [], eventInvoices: [], stockTransfers: [], purchaseOrders: [], expenses: [], employeeReimbursements: [], employeeBenefits: [] });
  const [tab, setTab] = useState<'ALL' | Item['kind']>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelectedState] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [lineDiscounts, setLineDiscounts] = useState<Record<string, string>>({});
  const [lineReasons, setLineReasons] = useState<Record<string, string>>({});
  const [transferQuantities, setTransferQuantities] = useState<Record<string, string>>({});

  const openItem = (item: Item) => {
    setSelectedState(item);
    setReason('');
    if (item.kind === 'EVENT_INVOICE') {
      setLineDiscounts(Object.fromEntries((item.value.items || []).map((line: any) => [line.id, String(line.requestedDiscount ?? line.discountAmount ?? 0)])));
      setLineReasons(Object.fromEntries((item.value.items || []).map((line: any) => [line.id, line.discountReason || ''])));
    }
    if (item.kind === 'STOCK_TRANSFER') {
      setTransferQuantities(Object.fromEntries((item.value.items || []).map((line: any) => [line.id, String(line.quantity ?? '')])));
    }
  };
  const setSelected = (item: Item | null) => item ? openItem(item) : setSelectedState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [approvalResponse, expenseResponse, reimbursementResponse, benefitsResponse] = await Promise.all([
        fetch('/api/v1/approval-center', { cache: 'no-store' }),
        fetch('/api/v1/financial-control/expenses', { cache: 'no-store' }),
        fetch('/api/hr/expense-reimbursements', { cache: 'no-store' }),
        fetch('/api/hr/benefits', { cache: 'no-store' }),
      ]);
      const body = await approvalResponse.json();
      const expenseBody = await expenseResponse.json();
      const reimbursementBody = await reimbursementResponse.json();
      const benefitsBody = await benefitsResponse.json();
      if (!approvalResponse.ok) throw new Error(body.error || 'Unable to load approval center');
      if (!expenseResponse.ok) throw new Error(expenseBody.error || 'Unable to load expense approvals');
      if (!reimbursementResponse.ok) throw new Error(reimbursementBody.error || 'Unable to load employee reimbursements');
      if (!benefitsResponse.ok) throw new Error(benefitsBody.error || 'Unable to load employee benefits');
      const expenseStage = audience === 'CASHIER' ? 'GENERAL_CASHIER' : audience === 'MANAGEMENT' ? 'GENERAL_MANAGER' : 'ACCOUNTANT';
      const employeeBenefits = audience === 'MANAGEMENT' ? [...(benefitsBody.loans || []).filter((item: any) => item.status === 'MANAGER_REVIEW').map((value: any) => ({ ...value, benefitType: 'LOAN', details: { name: `Employee loan · ${value.staffName}`, price: value.principalAmount } })), ...(benefitsBody.advances || []).filter((item: any) => item.status === 'MANAGER_REVIEW').map((value: any) => ({ ...value, benefitType: 'ADVANCE', details: { name: `Salary advance · ${value.staffName}`, price: value.amount } }))] : [];
      setData({ ...(body.data || {}), expenses: (expenseBody.data || []).filter((expense: any) => expense.currentApprovalStage === expenseStage), employeeReimbursements: audience === 'MANAGEMENT' ? (reimbursementBody.claims || []).filter((claim: any) => claim.status === 'GENERAL_MANAGER_REVIEW') : [], employeeBenefits });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to load approval center'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const items = useMemo<Item[]>(() => [
    ...data.eventInvoices.map((value: any) => ({ kind: 'EVENT_INVOICE' as const, value })),
    ...data.refunds.map((value: any) => ({ kind: 'REFUND' as const, value })),
    ...data.priceApprovals.map((value: any) => ({ kind: 'POS' as const, value })),
    ...(data.stockTransfers || []).map((value: any) => ({ kind: 'STOCK_TRANSFER' as const, value })),
    ...(data.purchaseOrders || []).map((value: any) => ({ kind: 'PURCHASE_ORDER' as const, value })),
    ...(data.expenses || []).map((value: any) => ({ kind: 'EXPENSE' as const, value })),
    ...(data.employeeReimbursements || []).map((value: any) => ({ kind: 'EMPLOYEE_REIMBURSEMENT' as const, value })),
    ...(data.employeeBenefits || []).map((value: any) => ({ kind: 'EMPLOYEE_BENEFIT' as const, value })),
  ].filter((item) => {
    if (tab !== 'ALL' && item.kind !== tab) return false;
    const query = search.trim().toLowerCase();
    return !query || JSON.stringify(item.value).toLowerCase().includes(query);
  }), [data, search, tab]);

  const pending = items.filter((item) => item.kind === 'EXPENSE' ? Boolean(item.value.currentApprovalStage) : item.kind === 'EMPLOYEE_REIMBURSEMENT' ? item.value.status === 'GENERAL_MANAGER_REVIEW' : item.kind === 'EMPLOYEE_BENEFIT' ? item.value.status === 'MANAGER_REVIEW' : item.value.status === 'PENDING' || ['SUBMITTED', 'IN_REVIEW', 'APPROVED'].includes(item.value.workflowStatus) || ['PENDING_APPROVAL', 'ISSUED'].includes(item.value.status));
  const canAct = (item: Item) => {
    if (item.kind === 'EVENT_INVOICE') return audience === 'ACCOUNTING' ? ['SUBMITTED', 'IN_REVIEW'].includes(item.value.workflowStatus) : item.value.workflowStatus === 'APPROVED';
    if (item.kind === 'REFUND') {
      const stageAudience = item.value.approvalStage === 'GENERAL_CASHIER_REVIEW' ? 'CASHIER' : item.value.approvalStage === 'ACCOUNTANT_REVIEW' ? 'ACCOUNTING' : 'MANAGEMENT';
      return audience === stageAudience && item.value.status === 'PENDING_APPROVAL' && item.value.approval?.status === 'PENDING';
    }
    if (item.kind === 'STOCK_TRANSFER') return audience === 'ACCOUNTING' || audience === 'CASHIER'; // Management and General Cashier review stock transfers
    if (item.kind === 'PURCHASE_ORDER') return audience === 'ACCOUNTING' && (item.value.approvalStage === 'ACCOUNTANT' || item.value.approvalStage == null);
    if (item.kind === 'EXPENSE') return true;
    if (item.kind === 'EMPLOYEE_REIMBURSEMENT') return audience === 'MANAGEMENT' && item.value.status === 'GENERAL_MANAGER_REVIEW';
    if (item.kind === 'EMPLOYEE_BENEFIT') return audience === 'MANAGEMENT' && item.value.status === 'MANAGER_REVIEW';
    const stage = item.value.details?.stage;
    return audience === 'CASHIER' ? stage === 'GENERAL_CASHIER_REVIEW' : stage === 'ACCOUNTANT_REVIEW';
  };

  const act = async (action: 'approve' | 'reject' | 'issue') => {
    if (!selected) return;
    setBusy(true);
    try {
      let url = ''; let body: Record<string, unknown> = {};
      if (selected.kind === 'EVENT_INVOICE') {
        url = `/api/v1/approval-center/event-invoices/${selected.value.id}`;
        body = { action, discountReason: reason, lineDiscounts: Object.fromEntries(Object.entries(lineDiscounts).map(([id, value]) => [id, Number(value || 0)])), lineReasons };
      } else if (selected.kind === 'POS') {
        const stage = selected.value.details?.stage;
        url = stage === 'GENERAL_CASHIER_REVIEW' ? `/api/v1/pos/price-approvals/${selected.value.id}/cashier` : `/api/v1/pos/price-approvals/${selected.value.id}/accountant`;
        body = { notes: reason };
      } else if (selected.kind === 'STOCK_TRANSFER') {
        if (action === 'approve') {
          url = selected.value.status === 'ISSUED' 
            ? `/api/v1/inventory/transfers/${selected.value.id}/receive`
            : `/api/v1/inventory/transfers/${selected.value.id}/approve`;
        } else {
          url = `/api/v1/inventory/transfers/${selected.value.id}/reject`;
        }
        body = action === 'reject' ? { reason } : {};
      } else if (selected.kind === 'PURCHASE_ORDER') {
        url = `/api/v1/inventory/purchase-orders/${selected.value.id}/${action}`;
        body = action === 'reject' ? { reason } : {};
      } else if (selected.kind === 'EXPENSE') {
        url = `/api/v1/financial-control/expenses/${selected.value.id}/action`;
        body = action === 'reject' ? { action, reason } : { action };
      } else if (selected.kind === 'EMPLOYEE_REIMBURSEMENT') {
        url = '/api/hr/expense-reimbursements';
        body = { id: selected.value.id, action, ...(action === 'reject' ? { reason } : {}) };
      } else if (selected.kind === 'EMPLOYEE_BENEFIT') {
        const type = selected.value.benefitType === 'LOAN' ? 'LOAN' : 'ADVANCE';
        url = '/api/hr/benefits';
        body = { id: selected.value.id, action: `${action === 'approve' ? 'APPROVE' : 'REJECT'}_${type}`, ...(action === 'reject' ? { reason } : {}) };
      } else {
        url = `/api/manager/approvals/${selected.value.approval.id}/${action === 'approve' ? 'approve' : 'reject'}`;
        body = action === 'reject' ? { comment: reason } : { refundMethod: selected.value.requestedMethod || 'ORIGINAL_PAYMENT' };
      }
      const response = await fetch(url, { method: selected.kind === 'EMPLOYEE_REIMBURSEMENT' || selected.kind === 'EMPLOYEE_BENEFIT' ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Approval action failed');
      toast.success(action === 'issue' ? 'Invoice issued' : action === 'reject' ? 'Request rejected' : 'Approval recorded');
      setSelected(null); setReason(''); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Approval action failed'); }
    finally { setBusy(false); }
  };

  const saveTransferAdjustment = async () => {
    if (!selected || selected.kind !== 'STOCK_TRANSFER') return;
    const originalItems = selected.value.items || [];
    const items = originalItems
      .map((item: any) => ({ id: item.id, quantity: Number(transferQuantities[item.id]) }))
      .filter((item: any, index: number) => Number.isFinite(item.quantity) && item.quantity > 0 && item.quantity < Number(originalItems[index].quantity));
    if (!items.length) {
      toast.error('Enter a lower quantity for at least one item before saving.');
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/inventory/transfers/${selected.value.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Unable to save the adjustment');
      const updatedItems = originalItems.map((item: any) => {
        const revised = items.find((candidate: any) => candidate.id === item.id);
        if (!revised) return item;
        const ratio = revised.quantity / Number(item.quantity);
        return { ...item, quantity: revised.quantity, baseQuantity: Number(item.baseQuantity || 0) * ratio };
      });
      const updatedTransfer = { ...selected.value, items: updatedItems };
      setSelectedState({ kind: 'STOCK_TRANSFER', value: updatedTransfer });
      setTransferQuantities(Object.fromEntries(updatedItems.map((item: any) => [item.id, String(item.quantity)])));
      setData((current: any) => ({ ...current, stockTransfers: (current.stockTransfers || []).map((transfer: any) => transfer.id === updatedTransfer.id ? updatedTransfer : transfer) }));
      toast.success('Request quantities adjusted');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to save the adjustment'); }
    finally { setBusy(false); }
  };

  return <main className="min-h-full bg-[#07111f] px-4 py-6 text-slate-200 sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-[1480px] space-y-6">
    <header className="relative overflow-hidden rounded-3xl border border-white/[.08] bg-gradient-to-br from-[#142746] via-[#101a2d] to-[#09111f] p-6 shadow-2xl sm:p-8"><div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" /><div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.22em] text-cyan-300"><ShieldCheck className="h-4 w-4" />Controlled approvals</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">Approval Control Center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">One decision queue for event invoices, refunds, and F&amp;B pricing. Open each request in its dedicated review model and record an auditable decision.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading} className="border-white/10 bg-white/[.05] text-white hover:bg-white/[.1] hover:text-white"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh queue</Button></div><div className="relative mt-7 grid gap-3 sm:grid-cols-3"><Metric label="Awaiting my action" value={String(items.filter(canAct).length)} icon={Clock3} /><Metric label="Open requests" value={String(pending.length)} icon={FileCheck2} /><Metric label="Control scope" value={audience === 'ACCOUNTING' ? 'Finance review' : audience === 'MANAGEMENT' ? 'Management review' : 'Cashier review'} icon={WalletCards} /></div></header>
    <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#101a2d]/90 shadow-xl"><div className="flex flex-col gap-3 border-b border-white/[.07] p-5 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-semibold text-white">Approval register</h2><p className="mt-1 text-xs text-slate-500">{items.length} request{items.length === 1 ? '' : 's'} in this view</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search approvals…" className="h-9 w-full rounded-lg border border-white/10 bg-white/[.04] pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-600 sm:w-72" /></div><div className="flex flex-wrap rounded-lg border border-white/10 bg-white/[.03] p-1">{([['ALL', 'All'], ['EVENT_INVOICE', 'Events'], ['REFUND', 'Refunds'], ['POS', 'F&B pricing'], ['STOCK_TRANSFER', 'Stock'], ['EXPENSE', 'Expenses'], ['EMPLOYEE_REIMBURSEMENT', 'Staff claims']] as const).map(([value, text]) => <button key={value} onClick={() => setTab(value)} className={`rounded-md px-3 py-2 text-xs font-semibold ${tab === value ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}>{text}</button>)}</div></div></div>{loading ? <div className="p-16 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-cyan-300" /></div> : !items.length ? <div className="p-16 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-300" /><p className="mt-3 font-medium text-white">Approval queue is clear</p><p className="mt-1 text-sm text-slate-500">No requests match the current control scope.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="bg-slate-950/30 text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="px-5 py-3 text-left">Request</th><th className="px-5 py-3 text-left">Amount</th><th className="px-5 py-3 text-left">Workflow</th><th className="px-5 py-3 text-left">Created</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-white/[.07]">{items.map((item) => { const value = item.value; const title = item.kind === 'EVENT_INVOICE' ? eventName(value) : item.kind === 'REFUND' ? `${label(value.category)} · ${value.reservation?.confirmationNumber || 'Reservation'}` : item.kind === 'STOCK_TRANSFER' ? `Transfer: ${value.fromWarehouse?.name} to ${value.toWarehouse?.name}` : item.kind === 'EXPENSE' ? value.payee : item.kind === 'EMPLOYEE_REIMBURSEMENT' ? `${value.staffName} · ${value.claimNumber}` : item.kind === 'PURCHASE_ORDER' ? `Purchase Order ${value.poNumber}` : value.details?.productName || value.details?.name || 'F&B price request'; const status = item.kind === 'EVENT_INVOICE' ? value.workflowStatus : item.kind === 'REFUND' || item.kind === 'STOCK_TRANSFER' || item.kind === 'PURCHASE_ORDER' ? value.status : item.kind === 'EXPENSE' ? `Expense · ${value.currentApprovalStage}` : item.kind === 'EMPLOYEE_REIMBURSEMENT' ? value.status : `${value.status} · ${value.details?.stage || 'WORKFLOW'}`; const amount = item.kind === 'EVENT_INVOICE' ? money(value.totalAmount, value.currency) : item.kind === 'REFUND' ? money(value.approvedAmount || value.requestedAmount, value.currency) : item.kind === 'STOCK_TRANSFER' ? money((value.items || []).reduce((sum: number, line: any) => sum + Number(line.quantity) * Number(line.stockItem?.costPrice || 0), 0), 'NGN') : item.kind === 'EXPENSE' || item.kind === 'EMPLOYEE_REIMBURSEMENT' ? money(value.amount, value.currency) : item.kind === 'PURCHASE_ORDER' ? money(value.totalAmount, value.currency || 'NGN') : money(value.details?.newPrice ?? value.details?.price); return <tr key={`${item.kind}-${value.id}`} className="transition hover:bg-white/[.025]"><td className="px-5 py-4"><p className="font-medium text-slate-200">{title}</p><p className="mt-1 text-xs text-slate-500">{item.kind === 'EMPLOYEE_REIMBURSEMENT' ? `${value.claimNumber} · ${value.category}` : item.kind === 'EXPENSE' ? `${value.expenseReference} · ${value.category}` : item.kind === 'EVENT_INVOICE' ? 'Event invoice' : label(item.kind)}</p></td><td className="px-5 py-4 font-semibold text-white">{amount}</td><td className="px-5 py-4"><Badge variant="outline" className="border-white/10 bg-white/[.03] text-slate-300">{item.kind === 'REFUND' ? label(value.approvalStage || status) : status}</Badge><p className="mt-1 max-w-[260px] truncate text-xs text-slate-500">{value.description || value.reason || ''}</p></td><td className="px-5 py-4 text-xs text-slate-500">{dateTime(value.createdAt)}</td><td className="px-5 py-4 text-right"><Button size="sm" variant="outline" onClick={() => setSelected(item)} className="gap-1.5 border-white/10 bg-transparent text-slate-200 hover:bg-white/[.08]">Open review <ArrowUpRight className="h-3.5 w-3.5" /></Button></td></tr>; })}</tbody></table></div>}</section>
    {selected && <ApprovalReviewDialog selected={selected} audience={audience} busy={busy} reason={reason} setReason={setReason} lineDiscounts={lineDiscounts} setLineDiscounts={setLineDiscounts} lineReasons={lineReasons} setLineReasons={setLineReasons} transferQuantities={transferQuantities} setTransferQuantities={setTransferQuantities} saveTransferAdjustment={saveTransferAdjustment} canAct={canAct(selected)} onAction={act} onClose={() => setSelected(null)} />}
  </div></main>;
}

function PurchaseOrderReview({ value }: { value: any }) {
  const details = value.details || {};
  const items = value.items || details.items || [];
  const supplier = value.supplier || details.supplier || {};
  return <div className="space-y-5">
    <section className="grid gap-4 rounded-xl border border-cyan-400/20 bg-cyan-400/[.06] p-5 sm:grid-cols-2 lg:grid-cols-4">
      <Detail label="Purchase order" value={value.poNumber || details.reference || '—'} />
      <Detail label="Supplier" value={supplier.name || '—'} />
      <Detail label="Property" value={value.property?.name || '—'} />
      <Detail label="Approval stage" value={label(value.approvalStage || details.approvalStage || 'ACCOUNTANT')} />
      <Detail label="Expected date" value={dateTime(value.expectedDate)} />
      <Detail label="Created" value={dateTime(value.createdAt)} />
      <Detail label="Currency" value={value.currency || 'NGN'} />
      <Detail label="Total" value={money(value.totalAmount ?? value.amount, value.currency)} />
    </section>
    {value.notes && <p className="rounded-xl border border-white/10 bg-white/[.03] p-4 text-sm text-slate-300">Note: {value.notes}</p>}
    <section className="overflow-hidden rounded-xl border border-white/10">
      <div className="border-b border-white/10 bg-white/[.03] px-5 py-4"><h3 className="font-semibold text-white">Invoice line items</h3><p className="mt-1 text-xs text-slate-400">Review every requested item, quantity, unit price, and line total.</p></div>
      <div className="divide-y divide-white/10">{items.map((item: any) => <div key={item.id} className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_90px_130px_140px] sm:items-center"><div><p className="font-medium text-white">{item.stockItem?.name || item.description || 'Stock item'}</p><p className="mt-1 text-xs text-slate-500">{item.stockItem?.baseUnit ? `Base unit: ${label(String(item.stockItem.baseUnit))}` : `Stock item ID: ${item.stockItemId}`}</p></div><span className="text-slate-300">{Number(item.quantity)} {label(String(item.unitOfMeasure || 'UNIT'))}</span><span className="text-slate-300">{money(item.unitPrice, value.currency)}</span><span className="font-semibold text-white sm:text-right">{money(item.totalPrice, value.currency)}</span></div>)}</div>
      <div className="flex justify-between border-t border-white/10 bg-white/[.04] px-5 py-4 font-bold text-white"><span>Invoice total</span><span>{money(value.totalAmount ?? value.amount, value.currency)}</span></div>
    </section>
  </div>;
}

function RefundReview({ value }: { value: any }) {
  const reservation = value.reservation || {};
  const guest = reservation.primaryGuest || {};
  const room = reservation.reservationRooms?.[0]?.room;
  const snapshot = reservation.ratePlanSnapshot || {};
  const originalTotal = snapshot.total ?? snapshot.totalAmount ?? snapshot.grandTotal;
  const stage = value.approvalStage || 'GENERAL_CASHIER_REVIEW';
  return <div className="space-y-5">
    <section className="rounded-xl border border-violet-400/20 bg-violet-400/[.06] p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-violet-300">Reservation refund</p><h3 className="mt-2 text-2xl font-semibold text-white">{reservation.confirmationNumber || 'Reservation refund'}</h3><p className="mt-1 text-sm text-slate-300">{fullName(guest) || 'Guest not available'} · {reservation.property?.name || 'Property not available'}</p></div><Badge variant="outline" className="w-fit border-violet-300/30 bg-violet-300/10 text-violet-100">{label(stage)}</Badge></div>
      <p className="mt-4 border-t border-white/10 pt-4 text-sm text-slate-300">{value.reason || 'No cancellation/refund reason supplied.'}</p>
    </section>
    <section className="grid gap-4 rounded-xl border border-white/10 bg-white/[.03] p-5 sm:grid-cols-2 lg:grid-cols-4">
      <Detail label="Guest" value={fullName(guest) || '—'} /><Detail label="Guest email" value={guest.email || '—'} /><Detail label="Guest phone" value={guest.phone || '—'} /><Detail label="Property" value={reservation.property?.name || '—'} />
      <Detail label="Room type" value={room?.roomType?.name || '—'} /><Detail label="Room number" value={room?.number || 'Not assigned'} /><Detail label="Check-in" value={dateTime(reservation.checkIn)} /><Detail label="Check-out" value={dateTime(reservation.checkOut)} />
      <Detail label="Guests" value={`${reservation.adults || 0} adults · ${reservation.children || 0} children`} /><Detail label="Reservation status" value={label(reservation.status || '—')} /><Detail label="Refund category" value={label(value.category || '—')} /><Detail label="Requested by" value={value.requestedById || '—'} />
    </section>
    <section className="grid gap-4 rounded-xl border border-emerald-400/20 bg-emerald-400/[.05] p-5 sm:grid-cols-2 lg:grid-cols-4">
      <Detail label="Original reservation total" value={originalTotal == null ? 'Not available' : money(originalTotal, reservation.currency || value.currency)} /><Detail label="Payment received" value={value.payment?.amount == null ? 'Not available' : money(value.payment.amount, value.payment.currency || value.currency)} /><Detail label="Requested refund" value={money(value.requestedAmount, value.currency)} /><Detail label="Approved amount" value={value.approvedAmount == null ? 'Pending' : money(value.approvedAmount, value.currency)} />
      <Detail label="Payment provider" value={label(value.payment?.provider || '—')} /><Detail label="Payment method" value={label(value.payment?.method || value.requestedMethod || '—')} /><Detail label="Settlement" value={label(value.requestedMethod || 'ORIGINAL_PAYMENT')} /><Detail label="Gateway transaction" value={value.payment?.providerTransactionId || '—'} />
    </section>
    <section className="rounded-xl border border-white/10 bg-white/[.03] p-5"><h3 className="font-semibold text-white">Control trail</h3><div className="mt-4 grid gap-4 sm:grid-cols-3"><Detail label="Current stage" value={label(stage)} /><Detail label="Request status" value={label(value.status || '—')} /><Detail label="Requested at" value={dateTime(value.createdAt)} /></div>{value.approval?.details?.rejectionComment && <p className="mt-4 rounded-lg border border-rose-300/20 bg-rose-300/[.06] p-3 text-sm text-rose-100">Previous note: {value.approval.details.rejectionComment}</p>}</section>
  </div>;
}

function ApprovalReviewDialog({ selected, audience, busy, reason, setReason, lineDiscounts, setLineDiscounts, lineReasons, setLineReasons, transferQuantities, setTransferQuantities, saveTransferAdjustment, canAct, onAction, onClose }: { selected: Item; audience: ApprovalCenterProps['audience']; busy: boolean; reason: string; setReason: (value: string) => void; lineDiscounts: Record<string, string>; setLineDiscounts: (value: Record<string, string>) => void; lineReasons: Record<string, string>; setLineReasons: (value: Record<string, string>) => void; transferQuantities: Record<string, string>; setTransferQuantities: (value: Record<string, string>) => void; saveTransferAdjustment: () => Promise<void>; canAct: boolean; onAction: (action: 'approve' | 'reject' | 'issue') => Promise<void>; onClose: () => void }) {
  const invoice = selected.kind === 'EVENT_INVOICE' ? selected.value : null;
  const showDiscounts = invoice ? hasDiscountRequest(invoice) : false;
  const clientName = invoice?.event?.corporateAccount?.name || fullName(invoice?.event?.guest) || 'Individual client';
  const invoiceTotal = invoice ? Number(invoice.totalAmount || 0) : 0;
  const grossTotal = invoice ? (invoice.items || []).reduce((sum: number, line: any) => sum + Number(line.grossAmount || line.totalPrice || 0), 0) : 0;
  const discountTotal = invoice ? Number(invoice.totalDiscount || 0) : 0;
  const taxTotal = invoice ? Number(invoice.totalTax || 0) : 0;

  return <Dialog open onOpenChange={(open) => !open && !busy && onClose()}><DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden border-white/10 bg-[#101a2d] p-0 text-slate-100 sm:max-w-4xl"><DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5 pr-14"><div className="flex items-start justify-between gap-4"><div><DialogTitle className="text-xl font-semibold text-white">{selected.kind === 'EVENT_INVOICE' ? 'Review event invoice' : selected.kind === 'REFUND' ? 'Refund control review' : selected.kind === 'STOCK_TRANSFER' ? 'Stock Transfer Review' : selected.kind === 'EXPENSE' ? `Expense invoice ${selected.value.expenseReference}` : selected.kind === 'EMPLOYEE_REIMBURSEMENT' ? `Review reimbursement ${selected.value.claimNumber}` : selected.kind === 'PURCHASE_ORDER' ? `Purchase Order ${selected.value.poNumber}` : 'F&B pricing review'}</DialogTitle><DialogDescription className="mt-2 text-slate-400">{selected.kind === 'EVENT_INVOICE' ? 'Review the complete invoice before recording the controlled decision.' : selected.kind === 'STOCK_TRANSFER' ? 'Review the transfer request before approving or rejecting.' : selected.kind === 'EXPENSE' ? 'Review the expense line items before approving or rejecting.' : selected.kind === 'EMPLOYEE_REIMBURSEMENT' ? 'HR and Accounting have reviewed this claim. Record the final management decision.' : selected.kind === 'PURCHASE_ORDER' ? 'Review the purchase order details before making a decision.' : 'Review the evidence, then record the decision for this control stage.'}</DialogDescription></div>{selected.kind === 'EVENT_INVOICE' && <Badge variant="outline" className="shrink-0 border-cyan-300/30 bg-cyan-300/10 text-cyan-200">{label(invoice.workflowStatus)}</Badge>}</div></DialogHeader>
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      {selected.kind === 'EVENT_INVOICE' && <div className="space-y-6">
        <section className="grid gap-4 rounded-xl border border-white/10 bg-white/[.03] p-5 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Event" value={eventName(invoice)} /><Detail label="Client" value={clientName} /><Detail label="Invoice status" value={label(invoice.status || 'DRAFT')} /><Detail label="Submitted" value={dateTime(invoice.submittedAt || invoice.createdAt)} /></section>
        <section className="overflow-hidden rounded-xl border border-white/10"><div className="border-b border-white/10 bg-white/[.03] px-5 py-4"><h3 className="font-semibold text-white">Invoice items</h3><p className="mt-1 text-xs text-slate-400">All billable services included in this event booking.</p></div><div className="divide-y divide-white/10">{(invoice.items || []).map((line: any) => <div key={line.id} className="p-5"><div className="flex flex-col justify-between gap-2 sm:flex-row"><div><p className="font-medium text-white">{line.description}</p><p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{line.category || 'OTHER'} · {line.quantity} × {money(line.unitPrice, invoice.currency)}</p></div><p className="font-semibold text-white">{money(line.totalPrice, invoice.currency)}</p></div>{showDiscounts && audience === 'ACCOUNTING' && <div className="mt-4 grid gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[.06] p-4 sm:grid-cols-[160px_1fr]"><label className="text-xs text-slate-300">Approved discount<input value={lineDiscounts[line.id] ?? ''} onChange={(event) => setLineDiscounts({ ...lineDiscounts, [line.id]: event.target.value })} type="number" min="0" step="0.01" className="mt-1 h-9 w-full rounded border border-white/10 bg-white/[.05] px-2 text-white" /></label><label className="text-xs text-slate-300">Discount reason<input value={lineReasons[line.id] ?? ''} onChange={(event) => setLineReasons({ ...lineReasons, [line.id]: event.target.value })} className="mt-1 h-9 w-full rounded border border-white/10 bg-white/[.05] px-2 text-white" placeholder="Required when applying a discount" /></label></div>}</div>)}</div></section>
        {showDiscounts && <section className="rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-5"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><div><h3 className="font-semibold text-amber-100">Discount approval requested</h3><p className="mt-1 text-sm text-slate-300">Review the line-level requests above and confirm the approved amounts before approving this invoice.</p></div></div></section>}
        <section className="ml-auto max-w-md space-y-2 rounded-xl border border-white/10 bg-white/[.03] p-5 text-sm"><TotalRow label="Gross subtotal" value={money(grossTotal, invoice.currency)} /><TotalRow label="Discount" value={money(discountTotal, invoice.currency)} tone={discountTotal > 0 ? 'text-amber-300' : undefined} /><TotalRow label="Tax" value={money(taxTotal, invoice.currency)} /><div className="my-3 border-t border-white/10" /><TotalRow label="Invoice total" value={money(invoiceTotal, invoice.currency)} strong /></section>
        {audience === 'ACCOUNTING' && <label className="block text-sm text-slate-300">{showDiscounts ? 'Review note or rejection reason' : 'Review note (optional)'}<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-white/10 bg-white/[.05] p-3 text-white outline-none focus:border-cyan-300/50" placeholder={showDiscounts ? 'A reason is required if you reject this invoice.' : 'Add an internal review note if needed.'} /></label>}
      </div>}
      {selected.kind === 'REFUND' && <RefundReview value={selected.value} />}
      {selected.kind === 'PURCHASE_ORDER' && <PurchaseOrderReview value={selected.value} />}
      {selected.kind === 'POS' && <div className="rounded-xl border border-orange-400/15 bg-orange-400/[.06] p-5"><p className="text-xs uppercase tracking-wider text-orange-300">{label(selected.value.type)}</p><p className="mt-2 text-2xl font-semibold text-white">{selected.value.details?.productName || selected.value.details?.name || 'F&B item'}</p><p className="mt-2 text-sm text-slate-300">{money(selected.value.details?.newPrice ?? selected.value.details?.price)} requested price</p><label className="mt-5 block text-sm text-slate-300">Approval note<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-white/10 bg-white/[.05] p-3 text-white" /></label></div>}
      {selected.kind === 'EMPLOYEE_BENEFIT' && <div className="space-y-5"><section className="grid gap-4 rounded-xl border border-cyan-400/20 bg-cyan-400/[.06] p-5 text-sm sm:grid-cols-2 lg:grid-cols-4"><Detail label="Type" value={selected.value.benefitType === 'LOAN' ? 'Employee loan' : 'Salary advance'} /><Detail label="Employee" value={selected.value.staffName || '—'} /><Detail label="Department" value={selected.value.department || '—'} /><Detail label="Position" value={selected.value.position || '—'} /><Detail label="Amount" value={money(selected.value.benefitType === 'LOAN' ? selected.value.principalAmount : selected.value.amount)} /><Detail label="Requested" value={dateTime(selected.value.createdAt)} /><Detail label="Requested by" value={selected.value.requestedBy || '—'} /><Detail label="HR reviewed" value={dateTime(selected.value.hrApprovedAt)} /></section><section className="rounded-xl border border-white/10 bg-white/[.03] p-5"><h3 className="font-semibold text-white">Request details</h3><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-300">{selected.value.reason || 'No justification provided.'}</p>{selected.value.benefitType === 'LOAN' && <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 text-sm sm:grid-cols-3"><Detail label="Loan number" value={selected.value.loanNumber || '—'} /><Detail label="Term" value={`${selected.value.tenorMonths || 0} months`} /><Detail label="Monthly deduction" value={money(selected.value.monthlyDeduction)} /></div>}</section><label className="block text-sm text-slate-300">Decision note or rejection reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-white/10 bg-white/[.05] p-3 text-white" placeholder="A reason is required if you reject this request." /></label></div>}
      {selected.kind === 'EXPENSE' && <div className="space-y-4"><div className="grid gap-3 rounded-xl border border-violet-400/20 bg-violet-400/[.06] p-5 text-sm sm:grid-cols-3"><Detail label="Payee" value={selected.value.payee} /><Detail label="Category" value={selected.value.category} /><Detail label="Total" value={money(selected.value.amount, selected.value.currency)} /></div><p className="text-sm text-slate-300">{selected.value.description}</p><div className="overflow-hidden rounded-xl border border-white/10"><div className="grid grid-cols-[1fr_70px_110px_110px] gap-2 bg-white/[.04] px-4 py-2 text-xs font-semibold text-slate-400"><span>Item / service</span><span>Qty</span><span>Unit price</span><span className="text-right">Total</span></div>{(selected.value.lineItems || []).map((line: any, index: number) => <div key={`${line.description}-${index}`} className="grid grid-cols-[1fr_70px_110px_110px] gap-2 border-t border-white/10 px-4 py-3 text-sm"><span>{line.description}{line.unit ? ` · ${line.unit}` : ''}</span><span>{line.quantity}</span><span>{money(line.unitPrice, selected.value.currency)}</span><span className="text-right font-semibold">{money(line.total, selected.value.currency)}</span></div>)}<div className="flex justify-between border-t border-white/10 bg-white/[.04] px-4 py-3 font-bold"><span>Invoice total</span><span>{money(selected.value.amount, selected.value.currency)}</span></div></div><label className="block text-sm text-slate-300">Review note or rejection reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-white/10 bg-white/[.05] p-3 text-white" placeholder="A reason is required if you reject this invoice." /></label></div>}
      {selected.kind === 'EMPLOYEE_REIMBURSEMENT' && <div className="space-y-5"><section className="grid gap-4 rounded-xl border border-violet-400/20 bg-violet-400/[.06] p-5 text-sm sm:grid-cols-2 lg:grid-cols-4"><Detail label="Employee" value={selected.value.staffName || '—'} /><Detail label="Employee ID" value={selected.value.employeeId || '—'} /><Detail label="Category" value={selected.value.category || '—'} /><Detail label="Claim amount" value={money(selected.value.amount, selected.value.currency)} /></section><section className="grid gap-4 rounded-xl border border-white/10 bg-white/[.03] p-5 text-sm sm:grid-cols-2"><Detail label="Requested payment" value={label(selected.value.requestedPaymentMethod || 'CASH')} /><Detail label="Submitted" value={dateTime(selected.value.createdAt)} /><div className="sm:col-span-2"><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">Business justification</p><p className="mt-1 leading-6 text-slate-200">{selected.value.description || 'No description provided.'}</p></div>{selected.value.receiptUrl && <div className="sm:col-span-2"><a href={selected.value.receiptUrl} target="_blank" rel="noreferrer" className="text-sm text-cyan-300 underline underline-offset-4">View supporting receipt</a></div>}</section><label className="block text-sm text-slate-300">Decision note or rejection reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-white/10 bg-white/[.05] p-3 text-white" placeholder="A reason is required if you reject this claim." /></label></div>}
      {selected.kind === 'STOCK_TRANSFER' && <div className="space-y-5">
        <section className="rounded-xl border border-emerald-400/15 bg-emerald-400/[.06] p-5">
          <p className="text-xs uppercase tracking-wider text-emerald-300">STOCK TRANSFER • {selected.value.transferRef}</p>
          <p className="mt-2 text-xl font-semibold text-white">{selected.value.fromWarehouse?.name} → {selected.value.toWarehouse?.name}</p>
          <p className="mt-2 text-sm text-slate-300">{selected.value.items?.length || 0} item{selected.value.items?.length === 1 ? '' : 's'} requested · Total value: {money((selected.value.items || []).reduce((sum: number, i: any) => sum + (Number(i.quantity) * Number(i.stockItem?.costPrice || 0)), 0), 'NGN')}</p>
          {selected.value.notes && <p className="mt-3 border-t border-white/10 pt-3 text-xs leading-5 text-slate-400">Request note: {selected.value.notes}</p>}
        </section>
        <section className="overflow-hidden rounded-xl border border-white/10">
          <div className="border-b border-white/10 bg-white/[.03] px-5 py-4">
            <h3 className="font-semibold text-white">Requested stock items</h3>
            <p className="mt-1 text-xs text-slate-400">Review the requested issue unit and its base-unit equivalent before making a decision.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead className="bg-slate-950/30 text-left text-[10px] uppercase tracking-[.14em] text-slate-500">
                <tr><th className="px-5 py-3">Item</th><th className="px-5 py-3">Requested quantity</th><th className="px-5 py-3">Base quantity</th><th className="px-5 py-3">Notes</th></tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {(selected.value.items || []).map((item: any) => <tr key={item.id}>
                  <td className="px-5 py-4"><p className="font-medium text-white">{item.stockItem?.name || 'Stock item'}</p><p className="mt-1 text-xs text-slate-500">Base unit: {label(String(item.stockItem?.baseUnit || 'UNIT'))}</p></td>
                  <td className="px-5 py-4"><input type="number" min="0.0001" max={Number(item.quantity)} step="0.0001" value={transferQuantities[item.id] ?? String(item.quantity)} onChange={(event) => setTransferQuantities({ ...transferQuantities, [item.id]: event.target.value })} disabled={!canAct || busy} className="h-9 w-28 rounded-lg border border-white/10 bg-white/[.05] px-2 text-sm font-semibold text-emerald-200 outline-none focus:border-emerald-300/50 disabled:opacity-60" /><span className="ml-2 text-xs text-slate-400">{label(String(item.unitOfMeasure || item.stockItem?.baseUnit || 'UNIT'))}</span></td>
                  <td className="px-5 py-4 text-slate-300">{Number(item.baseQuantity || 0).toLocaleString()} {label(String(item.stockItem?.baseUnit || 'UNIT'))}</td>
                  <td className="px-5 py-4 text-xs text-slate-400">{item.notes || '—'}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>
        {canAct && <div className="flex justify-end"><Button variant="outline" onClick={() => void saveTransferAdjustment()} disabled={busy} className="border-amber-300/30 text-amber-200 hover:bg-amber-300/10">Save quantity adjustment</Button></div>}
        <label className="block text-sm text-slate-300">Approval/Rejection note<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-white/10 bg-white/[.05] p-3 text-white" /></label>
      </div>}
    </div>
    <DialogFooter className="shrink-0 !mx-0 !mb-0 rounded-none border-white/10 bg-[#0c1728] px-6 py-4"><Button variant="outline" onClick={onClose} disabled={busy} className="border-white/10 bg-transparent text-slate-200">Close</Button>{canAct && <>{selected.kind !== 'EVENT_INVOICE' || audience === 'ACCOUNTING' ? <Button variant="outline" onClick={() => void onAction('reject')} disabled={busy || (!reason.trim() && (selected.kind === 'STOCK_TRANSFER' || selected.kind === 'EXPENSE' || selected.kind === 'PURCHASE_ORDER' || selected.kind === 'EMPLOYEE_REIMBURSEMENT'))} className="border-rose-400/30 text-rose-200 hover:bg-rose-400/10"><X className="mr-2 h-4 w-4" />Reject</Button> : null}<Button onClick={() => void onAction(selected.kind === 'EVENT_INVOICE' ? audience === 'CASHIER' ? 'issue' : 'approve' : 'approve')} disabled={busy} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">{busy ? 'Recording…' : selected.kind === 'EVENT_INVOICE' && audience === 'CASHIER' ? 'Issue invoice' : selected.kind === 'EMPLOYEE_REIMBURSEMENT' ? 'Approve reimbursement' : selected.kind === 'STOCK_TRANSFER' && selected.value.status === 'ISSUED' ? 'Confirm Receipt' : selected.kind === 'REFUND' && selected.value.approvalStage !== 'MANAGEMENT_REVIEW' ? 'Advance approval' : 'Approve & process'}</Button></>}</DialogFooter>
  </DialogContent></Dialog>;
}

function Detail({ label: title, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">{title}</p><p className="mt-1 truncate text-sm font-medium text-white" title={value}>{value}</p></div>; }
function TotalRow({ label: title, value, tone, strong = false }: { label: string; value: string; tone?: string; strong?: boolean }) { return <div className={`flex justify-between gap-4 ${strong ? 'text-base font-bold text-white' : 'text-slate-300'}`}><span>{title}</span><span className={tone}>{value}</span></div>; }
function Metric({ label: title, value, icon: Icon }: { label: string; value: string; icon: ElementType }) { return <div className="rounded-xl border border-white/10 bg-white/[.06] p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p><Icon className="h-4 w-4 text-cyan-300" /></div><p className="mt-2 text-2xl font-black text-white">{value}</p></div>; }
