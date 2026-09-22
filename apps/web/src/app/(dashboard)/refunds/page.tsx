'use client';

import { useEffect, useMemo, useState } from 'react';
import { Banknote, Check, ChevronDown, CircleDollarSign, Clock3, FileCheck2, Loader2, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

type RefundRequest = {
  id: string;
  propertyId: string;
  requestedAmount: string | number;
  approvedAmount?: string | number | null;
  currency: string;
  category: string;
  reason: string;
  status: string;
  createdAt: string;
  payment?: { method: string };
  approval?: { id: string; status: string; details?: { stage?: string } | null } | null;
  requestedMethod?: string;
  bankName?: string | null;
  bankAccountName?: string | null;
  bankAccountNumber?: string | null;
  approvedMethod?: string | null;
  currentApproverId?: string | null;
  approvalRoleId?: string | null;
};

type Options = {
  approvers: { id: string; email: string }[];
  roles: { id: string; name: string }[];
  canReassign?: boolean;
};

const statusStyles: Record<string, string> = {
  PENDING_APPROVAL: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
  APPROVED: 'border-blue-300/20 bg-blue-300/10 text-blue-200',
  PROCESSING: 'border-indigo-300/20 bg-indigo-300/10 text-indigo-200',
  COMPLETED: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
  REJECTED: 'border-rose-300/20 bg-rose-300/10 text-rose-200',
  FAILED: 'border-rose-300/20 bg-rose-300/10 text-rose-200',
};

export default function RefundsPage() {
  const [requests, setRequests] = useState<RefundRequest[]>([]);
  const [options, setOptions] = useState<Record<string, Options>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const propertyIds = useMemo(() => Array.from(new Set(requests.map(request => request.propertyId))), [requests]);
  const filteredRequests = useMemo(() => requests.filter(request => {
    const matchesStatus = statusFilter === 'ALL' || request.status === statusFilter;
    const query = search.trim().toLowerCase();
    return matchesStatus && (!query || [request.id, request.category, request.reason, request.requestedMethod, request.approvedMethod].some(value => value?.toLowerCase().includes(query)));
  }), [requests, search, statusFilter]);
  const totalExposure = requests.filter(request => !['COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(request.status)).reduce((sum, request) => sum + Number(request.approvedAmount || request.requestedAmount), 0);
  const pendingCount = requests.filter(request => request.status === 'PENDING_APPROVAL').length;
  const approvedCount = requests.filter(request => ['APPROVED', 'PROCESSING'].includes(request.status)).length;
  const completedTotal = requests.filter(request => request.status === 'COMPLETED').reduce((sum, request) => sum + Number(request.approvedAmount || request.requestedAmount), 0);
  const money = (amount: number, currency = requests[0]?.currency || 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/refund-requests');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Unable to load refund requests');
      const loaded = payload.data || [];
      setRequests(loaded);
      const entries = await Promise.all(propertyIds.concat(loaded.map((request: RefundRequest) => request.propertyId)).filter((id, index, all) => all.indexOf(id) === index).map(async propertyId => {
        if (options[propertyId]) return [propertyId, options[propertyId]] as const;
        const result = await fetch(`/api/v1/refund-requests/assignment-options?propertyId=${propertyId}`);
        if (result.status === 403) return [propertyId, { approvers: [], roles: [], canReassign: false }] as const;
        const data = await result.json();
        return [propertyId, data.data] as const;
      }));
      setOptions(previous => ({ ...previous, ...Object.fromEntries(entries) }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Unable to load refund requests');
    } finally {
      setLoading(false);
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load(); }, []);

  async function assign(request: RefundRequest, field: 'approverId' | 'approvalRoleId', value: string) {
    setBusy(request.id);
    try {
      const response = await fetch(`/api/v1/refund-requests/${request.id}/assignment`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value || null }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update assignment');
      toast.success('Approval assignment updated');
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to update assignment'); }
    finally { setBusy(null); }
  }

  async function act(request: RefundRequest, action: 'approve' | 'reject') {
    if (!request.approval?.id) return;
    const comment = action === 'reject' ? window.prompt('Rejection reason')?.trim() : undefined;
    if (action === 'reject' && !comment) return;
    const refundMethod = action === 'approve' ? window.prompt('Settlement method: CASH, BANK_TRANSFER, or ORIGINAL_PAYMENT', request.requestedMethod || 'ORIGINAL_PAYMENT')?.trim().toUpperCase() : undefined;
    if (action === 'approve' && !refundMethod) return;
    setBusy(request.id);
    try {
      const response = await fetch(`/api/manager/approvals/${request.approval.id}/${action}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: action === 'reject' ? JSON.stringify({ comment }) : JSON.stringify({ refundMethod }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Unable to ${action} refund`);
      toast.success(action === 'approve' ? 'Refund approved' : 'Refund rejected');
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : `Unable to ${action} refund`); }
    finally { setBusy(null); }
  }

  async function settleCash(request: RefundRequest) {
    setBusy(request.id);
    try {
      const response = await fetch(`/api/v1/refund-requests/${request.id}/settle-cash`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to settle cash refund');
      toast.success('Cash refund settled');
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to settle cash refund'); }
    finally { setBusy(null); }
  }

  async function settleBank(request: RefundRequest) {
    const reference = window.prompt('Bank transfer reference')?.trim();
    if (!reference) return;
    setBusy(request.id);
    try {
      const response = await fetch(`/api/v1/refund-requests/${request.id}/settle-bank`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reference }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to settle bank refund');
      toast.success('Bank transfer refund settled');
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to settle bank refund'); }
    finally { setBusy(null); }
  }

  return (
    <div className="min-h-full bg-[#09111f] px-4 py-6 text-slate-200 sm:px-6 lg:px-8 lg:py-8">
      <div className="mx-auto max-w-[1480px] space-y-6">
        <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-emerald-300"><ShieldCheck className="h-4 w-4" />Refund control room</div><h1 className="text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">Refunds, controlled end to end.</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">A decision-grade queue for guest refunds, approval ownership, settlement evidence, and liability release before close.</p></div>
          <Button variant="outline" onClick={load} disabled={loading} className="border-white/10 bg-white/[.04] text-slate-200 hover:bg-white/[.08] hover:text-white"><RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Refresh register</Button>
        </header>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <ControlMetric label="Open exposure" value={money(totalExposure)} detail={`${requests.length - requests.filter(item => ['COMPLETED', 'REJECTED', 'FAILED', 'CANCELLED', 'EXPIRED'].includes(item.status)).length} active requests`} icon={CircleDollarSign} tone="amber" />
          <ControlMetric label="Awaiting approval" value={String(pendingCount)} detail="Requests needing a decision" icon={Clock3} tone="violet" />
          <ControlMetric label="Ready to settle" value={String(approvedCount)} detail="Approved or processing" icon={FileCheck2} tone="blue" />
          <ControlMetric label="Settled this register" value={money(completedTotal)} detail="Completed refund value" icon={Banknote} tone="emerald" />
        </div>

        <section className="rounded-2xl border border-white/[.08] bg-[#111a2b]/75 shadow-[0_18px_50px_rgba(0,0,0,.12)]">
          <div className="flex flex-col gap-4 border-b border-white/[.07] p-5 xl:flex-row xl:items-center xl:justify-between"><div><h2 className="font-semibold text-white">Refund register</h2><p className="mt-1 text-xs text-slate-500">Assign ownership, approve within policy, then capture the settlement method and evidence.</p></div><div className="flex flex-col gap-2 sm:flex-row"><div className="relative"><Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-500" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search request or reason" className="h-9 w-full rounded-lg border border-white/10 bg-white/[.04] pl-9 pr-3 text-xs text-slate-200 outline-none placeholder:text-slate-600 focus:border-emerald-400/50 sm:w-64" /></div><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="h-9 rounded-lg border border-white/10 bg-[#111a2b] px-3 text-xs text-slate-300 outline-none focus:border-emerald-400/50"><option value="ALL">All statuses</option>{['PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED', 'FAILED'].map(status => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></div></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-sm"><thead className="bg-slate-950/35 text-[10px] uppercase tracking-[.14em] text-slate-500"><tr className="text-left"><th className="px-5 py-3">Request</th><th className="px-5 py-3 text-right">Amount</th><th className="px-5 py-3">Reason / tender</th><th className="px-5 py-3">Status</th><th className="px-5 py-3">Approval ownership</th><th className="px-5 py-3">Control action</th></tr></thead><tbody className="divide-y divide-white/[.07]">
            {loading ? <tr><td colSpan={6} className="p-16 text-center"><Loader2 className="mx-auto h-6 w-6 animate-spin text-emerald-300" /><p className="mt-3 text-xs text-slate-500">Loading refund register…</p></td></tr> : !filteredRequests.length ? <tr><td colSpan={6} className="p-16 text-center"><FileCheck2 className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 text-sm text-slate-400">No refund requests match this view.</p><p className="mt-1 text-xs text-slate-600">Try clearing the search or status filter.</p></td></tr> : filteredRequests.map(request => {
              const propertyOptions = options[request.propertyId]; const isBusy = busy === request.id; const amount = Number(request.approvedAmount || request.requestedAmount);
              const stage = request.approval?.details?.stage;
              return <tr key={request.id} className="align-top transition hover:bg-white/[.025]"><td className="px-5 py-4"><div className="font-medium text-slate-200">{request.category.replaceAll('_', ' ')}</div><div className="mt-1 text-xs text-slate-500">{new Date(request.createdAt).toLocaleString()}</div><div className="mt-1 font-mono text-[10px] text-slate-600">{request.id}</div></td><td className="px-5 py-4 text-right"><div className="font-semibold text-white">{money(amount, request.currency)}</div><div className="mt-1 text-[10px] text-slate-600">{request.currency}</div></td><td className="max-w-xs px-5 py-4"><div className="text-slate-300">{request.reason}</div><div className="mt-1 text-xs text-slate-500">Requested: {request.requestedMethod || 'ORIGINAL_PAYMENT'}</div>{request.requestedMethod === 'BANK_TRANSFER' && <div className="mt-1 text-xs text-cyan-300">{request.bankName || 'Bank'} · {request.bankAccountName || 'Account name'} · {request.bankAccountNumber || 'Account number'}</div>}</td><td className="px-5 py-4"><Badge className={`border ${statusStyles[request.status] || 'border-white/10 bg-white/5 text-slate-300'}`}>{request.status.replaceAll('_', ' ')}</Badge>{stage && <div className="mt-2 text-xs font-semibold text-amber-300">{stage.replaceAll('_', ' ')}</div>}{request.approvedMethod && <div className="mt-2 text-xs text-slate-500">Settlement: <span className="text-slate-300">{request.approvedMethod.replaceAll('_', ' ')}</span></div>}</td><td className="px-5 py-4"><div className="min-w-52 space-y-2">{propertyOptions ? <>{propertyOptions.canReassign ? <><Select label="Assign staff" defaultValue={request.currentApproverId || ''} onChange={value => assign(request, 'approverId', value)} options={[{ value: '', label: 'Automatic / no named staff' }, ...propertyOptions.approvers.map(approver => ({ value: approver.id, label: approver.email }))]} disabled={request.status !== 'PENDING_APPROVAL' || isBusy} /><Select label="Assign role" defaultValue={request.approvalRoleId || ''} onChange={value => assign(request, 'approvalRoleId', value)} options={[{ value: '', label: 'Automatic / no named role' }, ...propertyOptions.roles.map(role => ({ value: role.id, label: role.name }))]} disabled={request.status !== 'PENDING_APPROVAL' || isBusy} /><span className="block text-[10px] text-slate-600">Rule-based assignment is the default; changes here are logged overrides.</span></> : <span className="block text-[10px] text-slate-600">Automatic assignment · ownership changes restricted to finance administrators.</span>}</> : <span className="text-xs text-slate-600">Loading assignment options…</span>}</div></td><td className="px-5 py-4"><div className="flex flex-wrap items-center gap-2">{request.status === 'PENDING_APPROVAL' && request.approval?.status === 'PENDING' && <><Button size="sm" onClick={() => act(request, 'approve')} disabled={isBusy} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400"><Check className="mr-1 h-4 w-4" />Approve</Button><Button size="sm" variant="outline" onClick={() => act(request, 'reject')} disabled={isBusy} className="border-white/10 bg-transparent text-slate-300 hover:bg-rose-500/10 hover:text-rose-200"><X className="mr-1 h-4 w-4" />Reject</Button></>}{request.status === 'APPROVED' && request.approvedMethod === 'CASH' && <Button size="sm" onClick={() => settleCash(request)} disabled={isBusy} className="bg-blue-500 text-white hover:bg-blue-400"><Banknote className="mr-1 h-4 w-4" />Settle cash</Button>}{request.status === 'APPROVED' && request.approvedMethod === 'BANK_TRANSFER' && <Button size="sm" onClick={() => settleBank(request)} disabled={isBusy} className="bg-blue-500 text-white hover:bg-blue-400">Settle bank</Button>}{isBusy && <Loader2 className="h-4 w-4 animate-spin text-emerald-300" />}{request.status === 'COMPLETED' && <span className="text-xs text-emerald-300">Posted and settled</span>}</div></td></tr>;
            })}
          </tbody></table></div>
          <div className="flex flex-col justify-between gap-2 border-t border-white/[.07] px-5 py-3 text-xs text-slate-600 sm:flex-row"><span>Showing {filteredRequests.length} of {requests.length} requests</span><span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" /> Settlement posts through the controlled accounting workflow</span></div>
        </section>
      </div>
    </div>
  );
}

function ControlMetric({ label, value, detail, icon: Icon, tone }: { label: string; value: string; detail: string; icon: React.ElementType; tone: 'emerald' | 'blue' | 'amber' | 'violet' }) {
  const colors = { emerald: 'text-emerald-300 bg-emerald-400/10 ring-emerald-400/15', blue: 'text-blue-300 bg-blue-400/10 ring-blue-400/15', amber: 'text-amber-300 bg-amber-400/10 ring-amber-400/15', violet: 'text-violet-300 bg-violet-400/10 ring-violet-400/15' };
  return <div className="rounded-2xl border border-white/[.08] bg-[#111a2b]/75 p-5 shadow-[0_16px_40px_rgba(0,0,0,.1)]"><div className="flex items-start justify-between gap-3"><p className="text-[11px] font-semibold uppercase tracking-[.15em] text-slate-500">{label}</p><span className={`flex h-9 w-9 items-center justify-center rounded-xl ring-1 ${colors[tone]}`}><Icon className="h-4 w-4" /></span></div><p className="mt-4 text-2xl font-semibold tracking-[-.03em] text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>;
}

function Select({ label, defaultValue = '', onChange, options, disabled }: { label: string; defaultValue?: string; onChange: (value: string) => void; options: { value: string; label: string }[]; disabled?: boolean }) {
  return <div className="relative"><select aria-label={label} defaultValue={defaultValue} onChange={event => onChange(event.target.value)} disabled={disabled} className="h-9 w-full appearance-none rounded-md border bg-background px-3 pr-8 text-xs">{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-2.5 h-3.5 w-3.5 text-muted-foreground" /></div>;
}
