'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ElementType } from 'react';
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock3, FileCheck2, RefreshCw, Search, ShieldCheck, WalletCards, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type ApprovalCenterProps = { audience: 'ACCOUNTING' | 'CASHIER' };
type Item = { kind: 'EVENT_INVOICE' | 'REFUND' | 'POS'; value: any };

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
  const [data, setData] = useState<any>({ priceApprovals: [], refunds: [], eventInvoices: [] });
  const [tab, setTab] = useState<'ALL' | Item['kind']>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelectedState] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [lineDiscounts, setLineDiscounts] = useState<Record<string, string>>({});
  const [lineReasons, setLineReasons] = useState<Record<string, string>>({});

  const openItem = (item: Item) => {
    setSelectedState(item);
    setReason('');
    if (item.kind === 'EVENT_INVOICE') {
      setLineDiscounts(Object.fromEntries((item.value.items || []).map((line: any) => [line.id, String(line.requestedDiscount ?? line.discountAmount ?? 0)])));
      setLineReasons(Object.fromEntries((item.value.items || []).map((line: any) => [line.id, line.discountReason || ''])));
    }
  };
  const setSelected = (item: Item | null) => item ? openItem(item) : setSelectedState(null);

  const load = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/approval-center', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Unable to load approval center');
      setData(body.data || { priceApprovals: [], refunds: [], eventInvoices: [] });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to load approval center'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const items = useMemo<Item[]>(() => [
    ...data.eventInvoices.map((value: any) => ({ kind: 'EVENT_INVOICE' as const, value })),
    ...data.refunds.map((value: any) => ({ kind: 'REFUND' as const, value })),
    ...data.priceApprovals.map((value: any) => ({ kind: 'POS' as const, value })),
  ].filter((item) => {
    if (tab !== 'ALL' && item.kind !== tab) return false;
    const query = search.trim().toLowerCase();
    return !query || JSON.stringify(item.value).toLowerCase().includes(query);
  }), [data, search, tab]);

  const pending = items.filter((item) => item.value.status === 'PENDING' || ['SUBMITTED', 'IN_REVIEW', 'APPROVED'].includes(item.value.workflowStatus));
  const canAct = (item: Item) => {
    if (item.kind === 'EVENT_INVOICE') return audience === 'ACCOUNTING' ? ['SUBMITTED', 'IN_REVIEW'].includes(item.value.workflowStatus) : item.value.workflowStatus === 'APPROVED';
    if (item.kind === 'REFUND') return audience === 'ACCOUNTING' && item.value.status === 'PENDING_APPROVAL' && item.value.approval?.status === 'PENDING';
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
      } else {
        url = `/api/manager/approvals/${selected.value.approval.id}/${action === 'approve' ? 'approve' : 'reject'}`;
        body = action === 'reject' ? { comment: reason } : { refundMethod: selected.value.requestedMethod || 'ORIGINAL_PAYMENT' };
      }
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Approval action failed');
      toast.success(action === 'issue' ? 'Invoice issued' : action === 'reject' ? 'Request rejected' : 'Approval recorded');
      setSelected(null); setReason(''); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Approval action failed'); }
    finally { setBusy(false); }
  };

  return <main className="min-h-full bg-[#07111f] px-4 py-6 text-slate-200 sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-[1480px] space-y-6">
    <header className="relative overflow-hidden rounded-3xl border border-white/[.08] bg-gradient-to-br from-[#142746] via-[#101a2d] to-[#09111f] p-6 shadow-2xl sm:p-8"><div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" /><div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.22em] text-cyan-300"><ShieldCheck className="h-4 w-4" />Controlled approvals</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">Approval Control Center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">One decision queue for event invoices, refunds, and F&amp;B pricing. Open each request in its dedicated review model and record an auditable decision.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading} className="border-white/10 bg-white/[.05] text-white hover:bg-white/[.1] hover:text-white"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh queue</Button></div><div className="relative mt-7 grid gap-3 sm:grid-cols-3"><Metric label="Awaiting my action" value={String(items.filter(canAct).length)} icon={Clock3} /><Metric label="Open requests" value={String(pending.length)} icon={FileCheck2} /><Metric label="Control scope" value={audience === 'ACCOUNTING' ? 'Finance review' : 'Cashier review'} icon={WalletCards} /></div></header>
    <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#101a2d]/90 shadow-xl"><div className="flex flex-col gap-3 border-b border-white/[.07] p-5 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-semibold text-white">Approval register</h2><p className="mt-1 text-xs text-slate-500">{items.length} request{items.length === 1 ? '' : 's'} in this view</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search approval, guest, event…" className="h-9 w-full rounded-lg border border-white/10 bg-white/[.04] pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-600 sm:w-72" /></div><div className="flex rounded-lg border border-white/10 bg-white/[.03] p-1">{([['ALL', 'All'], ['EVENT_INVOICE', 'Events'], ['REFUND', 'Refunds'], ['POS', 'F&B pricing']] as const).map(([value, text]) => <button key={value} onClick={() => setTab(value)} className={`rounded-md px-3 py-2 text-xs font-semibold ${tab === value ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}>{text}</button>)}</div></div></div>{loading ? <div className="p-16 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-cyan-300" /></div> : !items.length ? <div className="p-16 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-300" /><p className="mt-3 font-medium text-white">Approval queue is clear</p><p className="mt-1 text-sm text-slate-500">No requests match the current control scope.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-slate-950/30 text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="px-5 py-3 text-left">Request</th><th className="px-5 py-3 text-left">Amount / value</th><th className="px-5 py-3 text-left">Workflow</th><th className="px-5 py-3 text-left">Created</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-white/[.07]">{items.map((item) => { const value = item.value; const title = item.kind === 'EVENT_INVOICE' ? eventName(value) : item.kind === 'REFUND' ? label(value.category) : value.details?.productName || value.details?.name || 'F&B price request'; const status = item.kind === 'EVENT_INVOICE' ? value.workflowStatus : item.kind === 'REFUND' ? value.status : `${value.status} · ${value.details?.stage || 'WORKFLOW'}`; const amount = item.kind === 'EVENT_INVOICE' ? money(value.totalAmount, value.currency) : item.kind === 'REFUND' ? money(value.approvedAmount || value.requestedAmount, value.currency) : money(value.details?.newPrice ?? value.details?.price); return <tr key={`${item.kind}-${value.id}`} className="transition hover:bg-white/[.025]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.kind === 'EVENT_INVOICE' ? 'bg-cyan-400/10 text-cyan-300' : item.kind === 'REFUND' ? 'bg-violet-400/10 text-violet-300' : 'bg-orange-400/10 text-orange-300'}`}>{item.kind === 'EVENT_INVOICE' ? <FileCheck2 className="h-4 w-4" /> : item.kind === 'REFUND' ? <WalletCards className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span><div><p className="font-medium text-slate-200">{title}</p><p className="mt-1 text-xs text-slate-500">{item.kind === 'EVENT_INVOICE' ? 'Event invoice' : item.kind === 'REFUND' ? value.reason : label(value.type)}</p></div></div></td><td className="px-5 py-4 font-semibold text-white">{amount}</td><td className="px-5 py-4"><Badge variant="outline" className="border-white/10 bg-white/[.03] text-slate-300">{status}</Badge></td><td className="px-5 py-4 text-xs text-slate-500">{new Date(value.createdAt).toLocaleString()}</td><td className="px-5 py-4 text-right"><Button size="sm" variant="outline" onClick={() => setSelected(item)} className="gap-1.5 border-white/10 bg-transparent text-slate-200 hover:bg-white/[.08]">Open review <ArrowUpRight className="h-3.5 w-3.5" /></Button></td></tr>; })}</tbody></table></div>}</section>
    {selected && <ApprovalReviewDialog selected={selected} audience={audience} busy={busy} reason={reason} setReason={setReason} lineDiscounts={lineDiscounts} setLineDiscounts={setLineDiscounts} lineReasons={lineReasons} setLineReasons={setLineReasons} canAct={canAct(selected)} onAction={act} onClose={() => setSelected(null)} />}
  </div></main>;
}

function ApprovalReviewDialog({ selected, audience, busy, reason, setReason, lineDiscounts, setLineDiscounts, lineReasons, setLineReasons, canAct, onAction, onClose }: { selected: Item; audience: ApprovalCenterProps['audience']; busy: boolean; reason: string; setReason: (value: string) => void; lineDiscounts: Record<string, string>; setLineDiscounts: (value: Record<string, string>) => void; lineReasons: Record<string, string>; setLineReasons: (value: Record<string, string>) => void; canAct: boolean; onAction: (action: 'approve' | 'reject' | 'issue') => Promise<void>; onClose: () => void }) {
  const invoice = selected.kind === 'EVENT_INVOICE' ? selected.value : null;
  const showDiscounts = invoice ? hasDiscountRequest(invoice) : false;
  const clientName = invoice?.event?.corporateAccount?.name || fullName(invoice?.event?.guest) || 'Individual client';
  const invoiceTotal = invoice ? Number(invoice.totalAmount || 0) : 0;
  const grossTotal = invoice ? (invoice.items || []).reduce((sum: number, line: any) => sum + Number(line.grossAmount || line.totalPrice || 0), 0) : 0;
  const discountTotal = invoice ? Number(invoice.totalDiscount || 0) : 0;
  const taxTotal = invoice ? Number(invoice.totalTax || 0) : 0;

  return <Dialog open onOpenChange={(open) => !open && !busy && onClose()}><DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col gap-0 overflow-hidden border-white/10 bg-[#101a2d] p-0 text-slate-100 sm:max-w-4xl"><DialogHeader className="shrink-0 border-b border-white/10 px-6 py-5 pr-14"><div className="flex items-start justify-between gap-4"><div><DialogTitle className="text-xl font-semibold text-white">{selected.kind === 'EVENT_INVOICE' ? 'Review event invoice' : selected.kind === 'REFUND' ? 'Refund control review' : 'F&B pricing review'}</DialogTitle><DialogDescription className="mt-2 text-slate-400">{selected.kind === 'EVENT_INVOICE' ? 'Review the complete invoice before recording the controlled decision.' : 'Review the evidence, then record the decision for this control stage.'}</DialogDescription></div>{selected.kind === 'EVENT_INVOICE' && <Badge variant="outline" className="shrink-0 border-cyan-300/30 bg-cyan-300/10 text-cyan-200">{label(invoice.workflowStatus)}</Badge>}</div></DialogHeader>
    <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
      {selected.kind === 'EVENT_INVOICE' && <div className="space-y-6">
        <section className="grid gap-4 rounded-xl border border-white/10 bg-white/[.03] p-5 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Event" value={eventName(invoice)} /><Detail label="Client" value={clientName} /><Detail label="Invoice status" value={label(invoice.status || 'DRAFT')} /><Detail label="Submitted" value={dateTime(invoice.submittedAt || invoice.createdAt)} /></section>
        <section className="overflow-hidden rounded-xl border border-white/10"><div className="border-b border-white/10 bg-white/[.03] px-5 py-4"><h3 className="font-semibold text-white">Invoice items</h3><p className="mt-1 text-xs text-slate-400">All billable services included in this event booking.</p></div><div className="divide-y divide-white/10">{(invoice.items || []).map((line: any) => <div key={line.id} className="p-5"><div className="flex flex-col justify-between gap-2 sm:flex-row"><div><p className="font-medium text-white">{line.description}</p><p className="mt-1 text-xs uppercase tracking-wider text-slate-500">{line.category || 'OTHER'} · {line.quantity} × {money(line.unitPrice, invoice.currency)}</p></div><p className="font-semibold text-white">{money(line.totalPrice, invoice.currency)}</p></div>{showDiscounts && audience === 'ACCOUNTING' && <div className="mt-4 grid gap-3 rounded-lg border border-amber-300/20 bg-amber-300/[.06] p-4 sm:grid-cols-[160px_1fr]"><label className="text-xs text-slate-300">Approved discount<input value={lineDiscounts[line.id] ?? ''} onChange={(event) => setLineDiscounts({ ...lineDiscounts, [line.id]: event.target.value })} type="number" min="0" step="0.01" className="mt-1 h-9 w-full rounded border border-white/10 bg-white/[.05] px-2 text-white" /></label><label className="text-xs text-slate-300">Discount reason<input value={lineReasons[line.id] ?? ''} onChange={(event) => setLineReasons({ ...lineReasons, [line.id]: event.target.value })} className="mt-1 h-9 w-full rounded border border-white/10 bg-white/[.05] px-2 text-white" placeholder="Required when applying a discount" /></label></div>}</div>)}</div></section>
        {showDiscounts && <section className="rounded-xl border border-amber-300/20 bg-amber-300/[.06] p-5"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><div><h3 className="font-semibold text-amber-100">Discount approval requested</h3><p className="mt-1 text-sm text-slate-300">Review the line-level requests above and confirm the approved amounts before approving this invoice.</p></div></div></section>}
        <section className="ml-auto max-w-md space-y-2 rounded-xl border border-white/10 bg-white/[.03] p-5 text-sm"><TotalRow label="Gross subtotal" value={money(grossTotal, invoice.currency)} /><TotalRow label="Discount" value={money(discountTotal, invoice.currency)} tone={discountTotal > 0 ? 'text-amber-300' : undefined} /><TotalRow label="Tax" value={money(taxTotal, invoice.currency)} /><div className="my-3 border-t border-white/10" /><TotalRow label="Invoice total" value={money(invoiceTotal, invoice.currency)} strong /></section>
        {audience === 'ACCOUNTING' && <label className="block text-sm text-slate-300">{showDiscounts ? 'Review note or rejection reason' : 'Review note (optional)'}<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-white/10 bg-white/[.05] p-3 text-white outline-none focus:border-cyan-300/50" placeholder={showDiscounts ? 'A reason is required if you reject this invoice.' : 'Add an internal review note if needed.'} /></label>}
      </div>}
      {selected.kind === 'REFUND' && <div className="rounded-xl border border-violet-400/15 bg-violet-400/[.06] p-5"><p className="text-xs uppercase tracking-wider text-violet-300">{label(selected.value.category)}</p><p className="mt-2 text-2xl font-semibold text-white">{money(selected.value.requestedAmount, selected.value.currency)}</p><p className="mt-2 text-sm text-slate-300">{selected.value.reason}</p><p className="mt-2 text-xs text-slate-500">Requested settlement: {label(selected.value.requestedMethod || 'ORIGINAL_PAYMENT')}</p></div>}
      {selected.kind === 'POS' && <div className="rounded-xl border border-orange-400/15 bg-orange-400/[.06] p-5"><p className="text-xs uppercase tracking-wider text-orange-300">{label(selected.value.type)}</p><p className="mt-2 text-2xl font-semibold text-white">{selected.value.details?.productName || selected.value.details?.name || 'F&B item'}</p><p className="mt-2 text-sm text-slate-300">{money(selected.value.details?.newPrice ?? selected.value.details?.price)} requested price</p><label className="mt-5 block text-sm text-slate-300">Approval note<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-2 min-h-24 w-full rounded-lg border border-white/10 bg-white/[.05] p-3 text-white" /></label></div>}
    </div>
    <DialogFooter className="shrink-0 !mx-0 !mb-0 rounded-none border-white/10 bg-[#0c1728] px-6 py-4"><Button variant="outline" onClick={onClose} disabled={busy} className="border-white/10 bg-transparent text-slate-200">Close</Button>{canAct && <>{selected.kind !== 'EVENT_INVOICE' || audience === 'ACCOUNTING' ? <Button variant="outline" onClick={() => void onAction('reject')} disabled={busy || !reason.trim()} className="border-rose-400/30 text-rose-200 hover:bg-rose-400/10"><X className="mr-2 h-4 w-4" />Reject</Button> : null}<Button onClick={() => void onAction(selected.kind === 'EVENT_INVOICE' ? audience === 'CASHIER' ? 'issue' : 'approve' : 'approve')} disabled={busy} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">{busy ? 'Recording…' : selected.kind === 'EVENT_INVOICE' && audience === 'CASHIER' ? 'Issue invoice' : 'Approve'}</Button></>}</DialogFooter>
  </DialogContent></Dialog>;
}

function Detail({ label: title, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-slate-500">{title}</p><p className="mt-1 truncate text-sm font-medium text-white" title={value}>{value}</p></div>; }
function TotalRow({ label: title, value, tone, strong = false }: { label: string; value: string; tone?: string; strong?: boolean }) { return <div className={`flex justify-between gap-4 ${strong ? 'text-base font-bold text-white' : 'text-slate-300'}`}><span>{title}</span><span className={tone}>{value}</span></div>; }
function Metric({ label: title, value, icon: Icon }: { label: string; value: string; icon: ElementType }) { return <div className="rounded-xl border border-white/10 bg-white/[.06] p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p><Icon className="h-4 w-4 text-cyan-300" /></div><p className="mt-2 text-2xl font-black text-white">{value}</p></div>; }
