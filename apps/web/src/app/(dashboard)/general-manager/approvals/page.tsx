'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowUpRight, Check, CheckCircle2, ClipboardCheck, Clock3, Loader2, RefreshCw, ShieldCheck, WalletCards, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GeneralManagerExpenseApprovalQueue } from '@/components/approvals/GeneralManagerExpenseApprovalQueue';

type ApprovalRequest = {
  id: string;
  propertyId: string;
  property?: { name?: string | null };
  type: string;
  status: string;
  amount?: number | string | null;
  currency?: string | null;
  reason: string;
  details?: Record<string, unknown> | null;
  requestedAt: string;
};

const labelFor = (value: string) => value.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

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

function money(request: ApprovalRequest) {
  if (request.amount == null) return null;
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: request.currency || 'NGN', maximumFractionDigits: 2 }).format(Number(request.amount));
}

export default function GeneralManagerApprovalsPage() {
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error?: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/mobile/v1/executive/approvals?propertyId=ALL_AUTHORIZED', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || 'Unable to load approval requests');
      setRequests(body.data || []);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Unable to load approval requests', error: true });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (request: ApprovalRequest, action: 'approve' | 'reject') => {
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
          } else {
            endpoint = `/api/v1/inventory/transfers/${request.id}/approve`;
          }
        } else {
          endpoint = `/api/v1/inventory/transfers/${request.id}/reject`;
        }
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'reject' ? { comment, reason: comment } : {}),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || body.error || 'Unable to process approval');
      setMessage({ text: successMessage });
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Unable to process approval', error: true });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="min-h-full bg-[#07111f] px-4 py-6 text-slate-200 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1480px] space-y-6 pb-10">
        <header className="relative overflow-hidden rounded-3xl border border-white/[.08] bg-gradient-to-br from-[#142746] via-[#101a2d] to-[#09111f] p-6 shadow-2xl sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.22em] text-cyan-300"><ShieldCheck className="h-4 w-4" />Executive control</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">Approval Control Centre</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">One controlled workspace for operational, financial, inventory, refund, discount, and F&amp;B decisions across your authorised properties.</p>
            </div>
            <Button variant="outline" onClick={() => void load()} disabled={loading} className="border-white/10 bg-white/[.05] text-white hover:bg-white/[.1] hover:text-white"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh queue</Button>
          </div>
          <div className="relative mt-7 grid gap-3 sm:grid-cols-3">
            <Metric label="Awaiting my action" value={String(requests.length)} icon={Clock3} />
            <Metric label="Operational requests" value={String(requests.filter((request) => request.type !== 'STOCK_TRANSFER').length)} icon={ClipboardCheck} />
            <Metric label="Inventory controls" value={String(requests.filter((request) => request.type === 'STOCK_TRANSFER').length)} icon={WalletCards} />
          </div>
        </header>

        {message && <div className={`flex items-center gap-2 rounded-xl border p-3 text-sm ${message.error ? 'border-rose-400/20 bg-rose-400/[.08] text-rose-200' : 'border-emerald-400/20 bg-emerald-400/[.08] text-emerald-200'}`}><AlertCircle className="h-4 w-4" />{message.text}</div>}

        <section className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#101a2d]/90 shadow-xl">
          <div className="flex items-center justify-between gap-4 border-b border-white/[.07] p-5"><div><h2 className="font-semibold text-white">Approval register</h2><p className="mt-1 text-xs text-slate-500">{requests.length} request{requests.length === 1 ? '' : 's'} awaiting General Manager action</p></div><Badge variant="outline" className="border-amber-300/20 bg-amber-300/[.08] px-3 py-1 text-amber-200">{requests.length} pending</Badge></div>
          {loading ? <div className="p-16 text-center text-sm text-slate-500"><Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-cyan-300" />Loading approval queue…</div> : !requests.length ? <div className="p-16 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-300" /><p className="mt-3 font-medium text-white">Approval queue is clear</p><p className="mt-1 text-sm text-slate-500">No requests are awaiting manager action.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[920px] text-sm"><thead className="bg-slate-950/30 text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="px-5 py-3 text-left">Request</th><th className="px-5 py-3 text-left">Amount / value</th><th className="px-5 py-3 text-left">Workflow</th><th className="px-5 py-3 text-left">Submitted</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-white/[.07]">{requests.map((request) => { const amount = money(request); const busy = busyId === request.id; return <tr key={request.id} className="transition hover:bg-white/[.025]"><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300"><ClipboardCheck className="h-4 w-4" /></span><div><p className="font-medium text-slate-200">{requestTitle(request)}</p><p className="mt-1 text-xs text-slate-500">{requestSubtitle(request)} · {request.property?.name || 'Authorised property'}</p></div></div></td><td className="px-5 py-4 font-semibold text-white">{amount || '—'}</td><td className="px-5 py-4"><Badge variant="outline" className="border-white/10 bg-white/[.03] text-slate-300">{requestTypeLabel(request)}</Badge><p className="mt-1 max-w-[230px] truncate text-xs text-slate-500">{request.reason || 'No reason supplied'}</p></td><td className="px-5 py-4 text-xs text-slate-500">{new Date(request.requestedAt).toLocaleString()}</td><td className="px-5 py-4 text-right"><div className="flex justify-end gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={() => void decide(request, 'reject')} className="border-rose-400/20 bg-transparent text-rose-200 hover:bg-rose-400/10"><X className="mr-1.5 h-3.5 w-3.5" />Reject</Button><Button size="sm" disabled={busy} onClick={() => void decide(request, 'approve')} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">{busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1.5 h-3.5 w-3.5" />}Approve</Button><ArrowUpRight className="ml-1 self-center text-slate-600" /></div></td></tr>; })}</tbody></table></div>}
        </section>
        <GeneralManagerExpenseApprovalQueue />
      </div>
    </main>
  );
}

function Metric({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return <div className="rounded-xl border border-white/10 bg-white/[.06] p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p><Icon className="h-4 w-4 text-cyan-300" /></div><p className="mt-2 text-2xl font-black text-white">{value}</p></div>;
}
