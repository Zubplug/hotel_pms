'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from '@/components/PropertyProvider';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, ArrowUpRight, CheckCircle2, Clock3, FileWarning, Loader2, RefreshCw, ShieldAlert, WalletCards, Timer, DatabaseZap } from 'lucide-react';
import { format } from 'date-fns';
import { RequestResolutionModal } from '@/components/cash-management/request-resolution-modal';
import { ApproveResolutionModal } from '@/components/cash-management/approve-resolution-modal';

const statusLabel: Record<string, string> = { OPEN: 'Open', REJECTED: 'Returned', PENDING_APPROVAL: 'Awaiting approval', APPROVED: 'Resolved' };

export default function TransactionExceptionsPage() {
  const { propertyId } = useProperty();
  const { data: session } = useLodgeCoreSession();
  const user = session?.user as any;
  const [activeTab, setActiveTab] = useState('OPEN');
  const [selectedException, setSelectedException] = useState<any>(null);
  const [modal, setModal] = useState<'request' | 'approve' | null>(null);
  const canApprove = ['MANAGER', 'ACCOUNTANT', 'ADMIN', 'SUPER_ADMIN'].includes(user?.role || '');

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: ['transaction-exceptions', propertyId],
    queryFn: async () => {
      if (!propertyId) return { data: [] };
      const res = await fetch(`/api/v1/cash-management/transaction-exceptions?propertyId=${propertyId}`);
      if (!res.ok) throw new Error('Failed to fetch exceptions');
      return res.json();
    }, enabled: !!propertyId,
  });
  if (!propertyId) return null;

  const exceptions = data?.data || [];
  const open = exceptions.filter((e: any) => e.status === 'OPEN' || e.status === 'REJECTED');
  const pending = exceptions.filter((e: any) => e.status === 'PENDING_APPROVAL');
  const resolved = exceptions.filter((e: any) => e.status === 'APPROVED');
  const displayList = activeTab === 'OPEN' ? open : activeTab === 'PENDING_APPROVAL' ? pending : resolved;
  const exposure = exceptions.filter((e: any) => e.status !== 'APPROVED').reduce((sum: number, e: any) => sum + Number((e.payment || e.posPayment)?.amount || 0), 0);
  const sourceCount = (source: string) => exceptions.filter((e: any) => (e.payment ? 'Front Desk' : 'POS') === source).length;
  const now = Date.now();
  const ageing = {
    fresh: exceptions.filter((e: any) => now - new Date(e.questionedAt).getTime() <= 86_400_000).length,
    watch: exceptions.filter((e: any) => { const age = now - new Date(e.questionedAt).getTime(); return age > 86_400_000 && age <= 3 * 86_400_000; }).length,
    overdue: exceptions.filter((e: any) => now - new Date(e.questionedAt).getTime() > 3 * 86_400_000 && e.status !== 'APPROVED').length,
  };
  const openModal = (exception: any, next: 'request' | 'approve') => { setSelectedException(exception); setModal(next); };
  const closeModal = () => { setModal(null); setSelectedException(null); };

  return <div className="cashier-dark-surface min-h-full bg-[#07111f]">
    <div className="relative overflow-hidden bg-gradient-to-r from-[#0b1120] via-[#152542] to-[#0b1120] px-6 py-8 sm:px-8">
      <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-rose-500/15 blur-3xl" />
      <div className="relative mx-auto max-w-[1440px]">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-rose-300"><span className="h-1.5 w-1.5 rounded-full bg-rose-400" />Control centre</p><h1 className="text-2xl font-bold tracking-tight text-white">Transaction exceptions</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Investigate night-audit questions, document the cashier’s explanation, and route resolutions for controlled approval.</p></div>
          <Button variant="outline" onClick={() => void refetch()} className="w-fit gap-2 border-white/15 bg-white/10 text-white hover:bg-white/15 hover:text-white"><RefreshCw className="h-4 w-4" />Refresh queue</Button>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/10 bg-white/10 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Unresolved exposure</p><p className="mt-2 text-2xl font-black text-white">{formatCurrency(exposure, 'NGN')}</p><p className="mt-1 text-xs text-rose-200">{open.length + pending.length} items requiring control</p></div><div className="rounded-xl border border-white/10 bg-white/10 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Approval queue</p><p className="mt-2 text-2xl font-black text-white">{pending.length}</p><p className="mt-1 text-xs text-amber-200">Awaiting manager review</p></div><div className="rounded-xl border border-white/10 bg-white/10 p-4"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Resolved history</p><p className="mt-2 text-2xl font-black text-white">{resolved.length}</p><p className="mt-1 text-xs text-emerald-200">Approved and closed</p></div></div>
      </div>
    </div>
    <div className="mx-auto max-w-[1440px] space-y-6 px-5 py-7 sm:px-8">
      <div className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-rose-600"><ShieldAlert className="h-4 w-4" />Risk overview</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Where attention is needed</h2><p className="mt-1 text-sm text-slate-500">Prioritise unresolved items before they become open audit findings.</p></div><FileWarning className="h-5 w-5 text-rose-500" /></div><div className="mt-6 space-y-4"><div><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-slate-600">Open / returned</span><span className="font-semibold text-slate-900">{open.length}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-rose-500" style={{ width: `${Math.min(100, exceptions.length ? open.length / exceptions.length * 100 : 0)}%` }} /></div></div><div><div className="mb-1.5 flex justify-between text-xs"><span className="font-medium text-slate-600">Awaiting approval</span><span className="font-semibold text-slate-900">{pending.length}</span></div><div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-amber-400" style={{ width: `${Math.min(100, exceptions.length ? pending.length / exceptions.length * 100 : 0)}%` }} /></div></div></div></section>
        <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-indigo-300"><WalletCards className="h-4 w-4" />Source mix</div><h2 className="mt-2 text-lg font-semibold">Exception origin</h2><div className="mt-6 grid grid-cols-2 gap-3"><div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-slate-400">Front Desk</p><p className="mt-2 text-2xl font-black">{sourceCount('Front Desk')}</p><p className="mt-1 text-xs text-slate-500">folio payments</p></div><div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-slate-400">POS</p><p className="mt-2 text-2xl font-black">{sourceCount('POS')}</p><p className="mt-1 text-xs text-slate-500">outlet payments</p></div></div></section>
      </div>
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Fresh flags</p><Timer className="h-4 w-4 text-emerald-300" /></div><p className="mt-2 text-2xl font-black text-white">{ageing.fresh}</p><p className="mt-1 text-xs text-slate-400">Questioned within 24 hours</p></div>
        <div className="rounded-2xl border border-white/10 bg-white/[.035] p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Watch list</p><Clock3 className="h-4 w-4 text-amber-300" /></div><p className="mt-2 text-2xl font-black text-white">{ageing.watch}</p><p className="mt-1 text-xs text-slate-400">1–3 days without closure</p></div>
        <div className="rounded-2xl border border-rose-400/20 bg-rose-400/[.08] p-4"><div className="flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-wider text-rose-300">Overdue control</p><DatabaseZap className="h-4 w-4 text-rose-300" /></div><p className="mt-2 text-2xl font-black text-white">{ageing.overdue}</p><p className="mt-1 text-xs text-rose-200/70">Open over 3 days</p></div>
      </section>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><TabsList className="h-auto w-full justify-start gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:w-fit"><TabsTrigger value="OPEN" className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-rose-50 data-[state=active]:text-rose-700">Needs resolution <Badge variant="secondary" className="rounded-full px-1.5">{open.length}</Badge></TabsTrigger><TabsTrigger value="PENDING_APPROVAL" className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-amber-50 data-[state=active]:text-amber-700">Approval queue <Badge variant="secondary" className="rounded-full px-1.5">{pending.length}</Badge></TabsTrigger><TabsTrigger value="APPROVED" className="gap-2 rounded-lg px-4 py-2.5 data-[state=active]:bg-emerald-50 data-[state=active]:text-emerald-700">History <Badge variant="secondary" className="rounded-full px-1.5">{resolved.length}</Badge></TabsTrigger></TabsList><p className="text-xs text-slate-500">Showing {displayList.length} of {exceptions.length} audit records</p></div>
        <TabsContent value={activeTab} className="mt-4"><div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{isLoading ? <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : error ? <div className="flex flex-col items-center gap-2 py-20 text-sm text-rose-600"><AlertCircle className="h-8 w-8 opacity-60" />Failed to load exceptions.</div> : displayList.length === 0 ? <div className="flex flex-col items-center gap-2 py-20 text-center"><CheckCircle2 className="h-10 w-10 text-emerald-500" /><p className="font-semibold text-slate-800">This queue is clear</p><p className="text-sm text-slate-500">No transaction exceptions match this workflow stage.</p></div> : <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b border-slate-100 bg-slate-50/80"><tr>{['Questioned', 'Transaction', 'Source / operator', 'Reason', 'Status', ''].map((heading) => <th key={heading} className="whitespace-nowrap px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{heading}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{displayList.map((exc: any) => { const tx = exc.payment || exc.posPayment; const isPayment = !!exc.payment; const source = isPayment ? 'Front Desk' : 'POS'; const operator = isPayment ? exc.payment?.frontdeskSession?.staff : exc.posPayment?.session?.primaryOperator; const operatorName = operator ? `${operator.firstName || ''} ${operator.lastName || ''}`.trim() : 'System review'; return <tr key={exc.id} className="group transition-colors hover:bg-slate-50/70"><td className="whitespace-nowrap px-5 py-4"><p className="font-medium text-slate-800">{format(new Date(exc.questionedAt), 'MMM d, yyyy')}</p><p className="mt-0.5 text-xs text-slate-400">{format(new Date(exc.questionedAt), 'HH:mm')}</p></td><td className="whitespace-nowrap px-5 py-4"><p className="font-semibold text-slate-900">{formatCurrency(Number(tx?.amount || 0), tx?.currency || 'NGN')}</p><p className="mt-1 font-mono text-xs text-slate-400">{tx?.reference || tx?.providerRef || tx?.gatewayTransactionId || 'No reference'}</p></td><td className="px-5 py-4"><p className="font-medium text-slate-700">{source}</p><p className="mt-1 text-xs text-slate-400">{operatorName}</p></td><td className="max-w-[260px] px-5 py-4"><p className="truncate text-slate-600" title={exc.questionReason}>{exc.questionReason || 'Review requested by audit'}</p><p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{tx?.method || 'Unknown method'}</p></td><td className="whitespace-nowrap px-5 py-4"><Badge className={exc.status === 'APPROVED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : exc.status === 'PENDING_APPROVAL' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-rose-200 bg-rose-50 text-rose-700'} variant="outline">{statusLabel[exc.status] || exc.status}</Badge></td><td className="whitespace-nowrap px-5 py-4 text-right">{(exc.status === 'OPEN' || exc.status === 'REJECTED') && <Button size="sm" variant="outline" onClick={() => openModal(exc, 'request')} className="gap-1.5 border-slate-200">Resolve <ArrowUpRight className="h-3.5 w-3.5" /></Button>}{exc.status === 'PENDING_APPROVAL' && canApprove && <Button size="sm" onClick={() => openModal(exc, 'approve')} className="gap-1.5 bg-slate-900">Review <ArrowUpRight className="h-3.5 w-3.5" /></Button>}{exc.status === 'PENDING_APPROVAL' && !canApprove && <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Clock3 className="h-3.5 w-3.5" />Waiting approval</span>}{exc.status === 'APPROVED' && <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" />Resolved</span>}</td></tr>; })}</tbody></table></div>}</div></TabsContent>
      </Tabs>
    </div>
    {selectedException && modal === 'request' && <RequestResolutionModal exception={selectedException} isOpen onClose={closeModal} onSuccess={() => { closeModal(); void refetch(); }} />}
    {selectedException && modal === 'approve' && <ApproveResolutionModal exception={selectedException} isOpen onClose={closeModal} onSuccess={() => { closeModal(); void refetch(); }} />}
  </div>;
}
