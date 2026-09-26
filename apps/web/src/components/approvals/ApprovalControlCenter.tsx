'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock3, FileCheck2, RefreshCw, Search, ShieldCheck, WalletCards, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';

type ApprovalCenterProps = { audience: 'ACCOUNTING' | 'CASHIER' };
type Item = { kind: 'EVENT_INVOICE' | 'REFUND' | 'POS'; value: any };

const money = (value: unknown, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(Number(value || 0));
const label = (value: string) => value.replaceAll('_', ' ');

export function ApprovalControlCenter({ audience }: ApprovalCenterProps) {
  const [data, setData] = useState<any>({ priceApprovals: [], refunds: [], eventInvoices: [] });
  const [tab, setTab] = useState<'ALL' | Item['kind']>('ALL');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Item | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [discount, setDiscount] = useState('');
  const [reason, setReason] = useState('');

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
    if (!query) return true;
    const value = item.value;
    return JSON.stringify(value).toLowerCase().includes(query);
  }), [data, search, tab]);

  const pending = items.filter((item) => item.value.status === 'PENDING' || ['SUBMITTED', 'IN_REVIEW', 'APPROVED'].includes(item.value.workflowStatus));
  const eventName = (invoice: any) => {
    if (invoice.event?.name) return invoice.event.name;
    if (invoice.event?.guest) return `${invoice.event.guest.firstName || ''} ${invoice.event.guest.lastName || ''}`.trim() || 'Event invoice';
    return invoice.event?.corporateAccount?.name || 'Event invoice';
  };
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
      if (selected.kind === 'EVENT_INVOICE') { url = `/api/v1/approval-center/event-invoices/${selected.value.id}`; body = { action, discountAmount: discount ? Number(discount) : undefined, discountReason: reason }; }
      else if (selected.kind === 'POS') { const stage = selected.value.details?.stage; url = stage === 'GENERAL_CASHIER_REVIEW' ? `/api/v1/pos/price-approvals/${selected.value.id}/cashier` : `/api/v1/pos/price-approvals/${selected.value.id}/accountant`; body = { notes: reason }; }
      else { url = `/api/manager/approvals/${selected.value.approval.id}/${action === 'approve' ? 'approve' : 'reject'}`; body = action === 'reject' ? { comment: reason } : { refundMethod: selected.value.requestedMethod || 'ORIGINAL_PAYMENT' }; }
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Approval action failed');
      toast.success(action === 'issue' ? 'Invoice issued' : action === 'reject' ? 'Request rejected' : 'Approval recorded');
      setSelected(null); setReason(''); setDiscount(''); await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Approval action failed'); }
    finally { setBusy(false); }
  };

  return <main className="min-h-full bg-[#07111f] px-4 py-6 text-slate-200 sm:px-6 lg:px-8 lg:py-8"><div className="mx-auto max-w-[1480px] space-y-6">
    <header className="relative overflow-hidden rounded-3xl border border-white/[.08] bg-gradient-to-br from-[#142746] via-[#101a2d] to-[#09111f] p-6 shadow-2xl sm:p-8"><div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" /><div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end"><div><p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.22em] text-cyan-300"><ShieldCheck className="h-4 w-4" />Controlled approvals</p><h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">Approval Control Center</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">One decision queue for event invoices, refunds, and F&amp;B pricing. Open each request in its dedicated review model and record an auditable decision.</p></div><Button variant="outline" onClick={() => void load()} disabled={loading} className="border-white/10 bg-white/[.05] text-white hover:bg-white/[.1] hover:text-white"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh queue</Button></div><div className="relative mt-7 grid gap-3 sm:grid-cols-3"><Metric label="Awaiting my action" value={String(items.filter(canAct).length)} icon={Clock3} /><Metric label="Open requests" value={String(pending.length)} icon={FileCheck2} /><Metric label="Control scope" value={audience === 'ACCOUNTING' ? 'Finance review' : 'Cashier review'} icon={WalletCards} /></div></header>
    <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#101a2d]/90 shadow-xl"><div className="flex flex-col gap-3 border-b border-white/[.07] p-5 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="font-semibold text-white">Approval register</h2><p className="mt-1 text-xs text-slate-500">{items.length} request{items.length === 1 ? '' : 's'} in this view</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search approval, guest, event…" className="h-9 w-full rounded-lg border border-white/10 bg-white/[.04] pl-9 pr-3 text-xs text-white outline-none placeholder:text-slate-600 sm:w-72" /></div><div className="flex rounded-lg border border-white/10 bg-white/[.03] p-1">{([['ALL', 'All'], ['EVENT_INVOICE', 'Events'], ['REFUND', 'Refunds'], ['POS', 'F&B pricing']] as const).map(([value, text]) => <button key={value} onClick={() => setTab(value)} className={`rounded-md px-3 py-2 text-xs font-semibold ${tab === value ? 'bg-cyan-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}>{text}</button>)}</div></div></div>{loading ? <div className="p-16 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-cyan-300" /></div> : !items.length ? <div className="p-16 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-300" /><p className="mt-3 font-medium text-white">Approval queue is clear</p><p className="mt-1 text-sm text-slate-500">No requests match the current control scope.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="bg-slate-950/30 text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="px-5 py-3 text-left">Request</th><th className="px-5 py-3 text-left">Amount / value</th><th className="px-5 py-3 text-left">Workflow</th><th className="px-5 py-3 text-left">Created</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-white/[.07]">{items.map((item) => { const value = item.value; const title = item.kind === 'EVENT_INVOICE' ? eventName(value) : item.kind === 'REFUND' ? label(value.category) : value.details?.productName || value.details?.name || 'F&B price request'; const status = item.kind === 'EVENT_INVOICE' ? value.workflowStatus : item.kind === 'REFUND' ? value.status : `${value.status} · ${value.details?.stage || 'WORKFLOW'}`; const amount = item.kind === 'EVENT_INVOICE' ? money(value.totalAmount, value.currency) : item.kind === 'REFUND' ? money(value.approvedAmount || value.requestedAmount, value.currency) : money(value.details?.newPrice ?? value.details?.price); return <tr key={`${item.kind}-${value.id}`} className="transition hover:bg-white/[.025]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${item.kind === 'EVENT_INVOICE' ? 'bg-cyan-400/10 text-cyan-300' : item.kind === 'REFUND' ? 'bg-violet-400/10 text-violet-300' : 'bg-orange-400/10 text-orange-300'}`}>{item.kind === 'EVENT_INVOICE' ? <FileCheck2 className="h-4 w-4" /> : item.kind === 'REFUND' ? <WalletCards className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span><div><p className="font-medium text-slate-200">{title}</p><p className="mt-1 text-xs text-slate-500">{item.kind === 'EVENT_INVOICE' ? 'Event invoice' : item.kind === 'REFUND' ? value.reason : label(value.type)}</p></div></div></td><td className="px-5 py-4 font-semibold text-white">{amount}</td><td className="px-5 py-4"><Badge variant="outline" className="border-white/10 bg-white/[.03] text-slate-300">{status}</Badge></td><td className="px-5 py-4 text-xs text-slate-500">{new Date(value.createdAt).toLocaleString()}</td><td className="px-5 py-4 text-right"><Button size="sm" variant="outline" onClick={() => setSelected(item)} className="gap-1.5 border-white/10 bg-transparent text-slate-200 hover:bg-white/[.08]">Open review <ArrowUpRight className="h-3.5 w-3.5" /></Button></td></tr>; })}</tbody></table></div>}</section>
    {selected && <Dialog open onOpenChange={(open) => !open && !busy && setSelected(null)}><DialogContent className="border-white/10 bg-[#101a2d] text-slate-100 sm:max-w-xl"><DialogHeader><DialogTitle className="text-white">{selected.kind === 'EVENT_INVOICE' ? 'Event invoice review' : selected.kind === 'REFUND' ? 'Refund control review' : 'F&B pricing review'}</DialogTitle><DialogDescription className="text-slate-400">Review the evidence, then record the decision for this control stage.</DialogDescription></DialogHeader><div className="space-y-4 py-2">{selected.kind === 'EVENT_INVOICE' && <><div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[.06] p-4"><p className="text-xs uppercase tracking-wider text-cyan-300">{eventName(selected.value)}</p><p className="mt-2 text-2xl font-semibold text-white">{money(selected.value.totalAmount, selected.value.currency)}</p><p className="mt-1 text-xs text-slate-400">Gross {money(selected.value.subTotal + selected.value.totalDiscount, selected.value.currency)} · Discount {money(selected.value.totalDiscount, selected.value.currency)} · Tax {money(selected.value.totalTax, selected.value.currency)}</p></div>{audience === 'ACCOUNTING' && <><label className="block text-xs text-slate-400">Approved discount<input value={discount} onChange={(event) => setDiscount(event.target.value)} type="number" min="0" step="0.01" placeholder={String(selected.value.requestedDiscount || 0)} className="mt-1 h-10 w-full rounded-lg border border-white/10 bg-white/[.05] px-3 text-white" /></label><label className="block text-xs text-slate-400">Review note / rejection reason<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-lg border border-white/10 bg-white/[.05] p-3 text-white" /></label></>}</>}{selected.kind === 'REFUND' && <div className="rounded-xl border border-violet-400/15 bg-violet-400/[.06] p-4"><p className="text-xs uppercase tracking-wider text-violet-300">{label(selected.value.category)}</p><p className="mt-2 text-2xl font-semibold text-white">{money(selected.value.requestedAmount, selected.value.currency)}</p><p className="mt-2 text-sm text-slate-300">{selected.value.reason}</p><p className="mt-2 text-xs text-slate-500">Requested settlement: {label(selected.value.requestedMethod || 'ORIGINAL_PAYMENT')}</p></div>}{selected.kind === 'POS' && <div className="rounded-xl border border-orange-400/15 bg-orange-400/[.06] p-4"><p className="text-xs uppercase tracking-wider text-orange-300">{label(selected.value.type)}</p><p className="mt-2 text-2xl font-semibold text-white">{selected.value.details?.productName || selected.value.details?.name || 'F&B item'}</p><p className="mt-2 text-sm text-slate-300">{money(selected.value.details?.newPrice ?? selected.value.details?.price)} requested price</p><label className="mt-4 block text-xs text-slate-400">Approval note<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-20 w-full rounded-lg border border-white/10 bg-white/[.05] p-3 text-white" /></label></div>}</div><DialogFooter><Button variant="outline" onClick={() => setSelected(null)} disabled={busy}>Close</Button>{canAct(selected) && <>{selected.kind === 'EVENT_INVOICE' && audience === 'ACCOUNTING' && <Button variant="outline" onClick={() => void act('reject')} disabled={busy || !reason.trim()} className="border-rose-400/30 text-rose-200"><X className="mr-2 h-4 w-4" />Reject</Button>}<Button onClick={() => void act(selected.kind === 'EVENT_INVOICE' ? audience === 'CASHIER' ? 'issue' : 'approve' : 'approve')} disabled={busy} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">{busy ? 'Recording…' : selected.kind === 'EVENT_INVOICE' && audience === 'CASHIER' ? 'Issue invoice' : 'Approve'}</Button></>}</DialogFooter></DialogContent></Dialog>}
  </div></main>;
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) { return <div className="rounded-xl border border-white/10 bg-white/[.06] p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p><Icon className="h-4 w-4 text-cyan-300" /></div><p className="mt-2 text-2xl font-black text-white">{value}</p></div>; }
