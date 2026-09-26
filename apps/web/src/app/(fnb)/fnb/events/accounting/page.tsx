import { Metadata } from 'next';
import Link from 'next/link';
import { ExportReportButton, ViewInvoiceButton } from '@/components/events/AccountingButtons';
import { prisma } from '@hotel-pms/db';
import { requireEventContext } from '@/lib/events/access';
import { ArrowUpRight, CheckCircle2, ChevronRight, CircleAlert, Clock3, FileCheck2, ReceiptText, Sparkles, WalletCards } from 'lucide-react';

export const metadata: Metadata = { title: 'Event Accounting | LodgeCore' };

const money = (value: number, currency = 'NGN') => `${currency === 'NGN' ? '₦' : currency} ${Math.round(value).toLocaleString('en-NG')}`;

function tone(value: string, kind: 'workflow' | 'financial') {
  if (kind === 'workflow') return ({ APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-200', ISSUED: 'bg-blue-50 text-blue-700 ring-blue-200', SUBMITTED: 'bg-amber-50 text-amber-700 ring-amber-200', IN_REVIEW: 'bg-violet-50 text-violet-700 ring-violet-200', REJECTED: 'bg-rose-50 text-rose-700 ring-rose-200', DRAFT: 'bg-slate-100 text-slate-600 ring-slate-200' } as Record<string, string>)[value] || 'bg-slate-100 text-slate-600 ring-slate-200';
  return ({ PAID: 'bg-emerald-50 text-emerald-700 ring-emerald-200', PARTIAL: 'bg-amber-50 text-amber-700 ring-amber-200', ISSUED: 'bg-blue-50 text-blue-700 ring-blue-200', UNPAID: 'bg-orange-50 text-orange-700 ring-orange-200', DRAFT: 'bg-slate-100 text-slate-600 ring-slate-200', VOID: 'bg-rose-50 text-rose-700 ring-rose-200' } as Record<string, string>)[value] || 'bg-slate-100 text-slate-600 ring-slate-200';
}

const label = (value: string) => value.replaceAll('_', ' ');

export default async function EventAccountingPage() {
  const { propertyId } = await requireEventContext();
  const invoiceWhere = { OR: [{ event: { propertyId } }, { propertyId }] };
  const [invoices, allInvoices, totals, workflowGroups] = await Promise.all([
    prisma.eventInvoice.findMany({ where: invoiceWhere, orderBy: { createdAt: 'desc' }, include: { event: true, leaseBillingSchedule: { include: { leaseContract: { include: { hall: true, corporateAccount: true } } } } }, take: 50 }),
    prisma.eventInvoice.findMany({ where: invoiceWhere, select: { status: true, workflowStatus: true, totalAmount: true, paidAmount: true, currency: true, createdAt: true } }),
    prisma.eventInvoice.aggregate({ where: invoiceWhere, _sum: { totalAmount: true, paidAmount: true } }),
    prisma.eventInvoice.groupBy({ by: ['workflowStatus'], where: invoiceWhere, _count: { _all: true } }),
  ]);

  const openInvoices = allInvoices.filter((invoice) => ['ISSUED', 'UNPAID', 'PARTIAL'].includes(invoice.status));
  const approvalQueue = allInvoices.filter((invoice) => ['SUBMITTED', 'IN_REVIEW'].includes(invoice.workflowStatus));
  const rejectedCount = allInvoices.filter((invoice) => invoice.workflowStatus === 'REJECTED').length;
  const issuedCount = allInvoices.filter((invoice) => ['ISSUED', 'PARTIAL', 'PAID'].includes(invoice.status)).length;
  const paidCount = allInvoices.filter((invoice) => invoice.status === 'PAID').length;
  const outstandingValue = openInvoices.reduce((sum, invoice) => sum + Math.max(Number(invoice.totalAmount) - Number(invoice.paidAmount), 0), 0);
  const collectedValue = Number(totals._sum.paidAmount || 0);
  const billedValue = Number(totals._sum.totalAmount || 0);
  const collectionRate = billedValue ? Math.round((collectedValue / billedValue) * 100) : 0;
  const workflowCount = (status: string) => workflowGroups.find((group) => group.workflowStatus === status)?._count._all || 0;
  const currentMonth = new Date().getMonth();
  const currentMonthInvoices = allInvoices.filter((invoice) => invoice.createdAt.getMonth() === currentMonth).length;
  const metricCards = [
    { label: 'Outstanding receivables', value: money(outstandingValue), detail: `${openInvoices.length} open invoice${openInvoices.length === 1 ? '' : 's'}`, icon: WalletCards, className: 'text-orange-700 bg-orange-50' },
    { label: 'Approval queue', value: approvalQueue.length.toLocaleString(), detail: `${workflowCount('SUBMITTED')} submitted · ${workflowCount('IN_REVIEW')} in review`, icon: FileCheck2, className: 'text-amber-700 bg-amber-50' },
    { label: 'Collected to date', value: money(collectedValue), detail: `${collectionRate}% of ${money(billedValue)} billed`, icon: CheckCircle2, className: 'text-emerald-700 bg-emerald-50' },
    { label: 'Issued invoices', value: issuedCount.toLocaleString(), detail: `${paidCount} fully paid · ${currentMonthInvoices} created this month`, icon: ReceiptText, className: 'text-blue-700 bg-blue-50' },
  ];

  return <div className="fnb-dark-surface min-h-full bg-[#fbf8f6] text-[#24130d]">
    <header className="border-b border-[#3d2318] bg-[#24130d] text-white"><div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-300"><Sparkles className="h-4 w-4" /> F&B finance control</div><h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Event accounting</h1><p className="mt-2 max-w-2xl text-sm text-orange-100/75">Control invoice approvals, event receivables, deposits, and posting readiness from one live workspace.</p></div><div className="flex flex-wrap gap-2"><Link href="/fnb/events/bookings" className="inline-flex h-9 items-center justify-center rounded-md border border-white/20 bg-white/10 px-3 text-xs font-bold text-white hover:bg-white/20">Event register <ArrowUpRight className="ml-2 h-4 w-4" /></Link><ExportReportButton invoices={invoices.map((invoice) => ({ event: invoice.event?.name || 'Event', status: invoice.status, total: Number(invoice.totalAmount), paid: Number(invoice.paidAmount), currency: invoice.currency }))} /></div></div></div></header>
    <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metricCards.map(({ label: metricLabel, value, detail, icon: Icon, className }) => <div key={metricLabel} className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#876f63]">{metricLabel}</p><p className="mt-3 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-xs text-[#947d72]">{detail}</p></div><div className={`rounded-xl p-3 ${className}`}><Icon className="h-5 w-5" /></div></div></div>)}</section>

      <section className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-2xl border border-[#eadfd8] bg-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-5 flex items-start justify-between gap-4"><div><h2 className="text-base font-bold">Revenue collection pulse</h2><p className="mt-1 text-xs text-[#947d72]">All event invoices for this property, independent of the recent-invoice list.</p></div><span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{collectionRate}% collected</span></div><div className="h-4 overflow-hidden rounded-full bg-[#f2e8e2]"><div className="h-full rounded-full bg-gradient-to-r from-orange-500 to-emerald-500 transition-all" style={{ width: `${Math.min(collectionRate, 100)}%` }} /></div><div className="mt-4 grid gap-4 sm:grid-cols-3"><div><p className="text-[10px] uppercase tracking-wider text-[#947d72]">Billed</p><p className="mt-1 text-lg font-bold">{money(billedValue)}</p></div><div><p className="text-[10px] uppercase tracking-wider text-[#947d72]">Collected</p><p className="mt-1 text-lg font-bold text-emerald-700">{money(collectedValue)}</p></div><div><p className="text-[10px] uppercase tracking-wider text-[#947d72]">Still open</p><p className="mt-1 text-lg font-bold text-orange-700">{money(outstandingValue)}</p></div></div></div>
        <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-[#fff8f2] to-white p-5 shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="mb-4 flex items-center gap-2"><CircleAlert className="h-5 w-5 text-orange-600" /><h2 className="text-base font-bold">Control-room signals</h2></div><div className="space-y-3 text-xs"><div className="flex items-center justify-between rounded-xl bg-white/80 p-3"><span className="text-[#6f5d53]">Invoices awaiting accounting</span><span className="font-bold text-amber-700">{approvalQueue.length}</span></div><div className="flex items-center justify-between rounded-xl bg-white/80 p-3"><span className="text-[#6f5d53]">Rejected for correction</span><span className="font-bold text-rose-700">{rejectedCount}</span></div><div className="flex items-center justify-between rounded-xl bg-white/80 p-3"><span className="text-[#6f5d53]">Posting-ready approvals</span><span className="font-bold text-emerald-700">{workflowCount('APPROVED')}</span></div></div></div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[#eadfd8] bg-white shadow-[0_8px_24px_rgba(65,32,19,0.045)]"><div className="flex flex-col justify-between gap-3 border-b border-[#eadfd8] px-5 py-5 sm:flex-row sm:items-center"><div><h2 className="text-base font-bold">Invoice control ledger</h2><p className="mt-1 text-xs text-[#947d72]">The latest 50 event and recurring hall invoices with financial status and approval workflow kept separate.</p></div><div className="flex items-center gap-2 text-xs text-[#947d72]"><Clock3 className="h-4 w-4" /> Live property ledger</div></div><div className="overflow-x-auto"><table className="w-full min-w-[940px] text-left text-sm"><thead className="bg-[#fffaf7] text-[10px] uppercase tracking-[0.12em] text-[#947d72]"><tr><th className="px-5 py-3">Event / invoice</th><th className="px-5 py-3">Created</th><th className="px-5 py-3">Financial status</th><th className="px-5 py-3">Approval workflow</th><th className="px-5 py-3 text-right">Balance</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#f0e6e0]">{invoices.length === 0 ? <tr><td colSpan={6} className="px-5 py-14 text-center text-sm text-[#947d72]">No event invoices have been generated yet.</td></tr> : invoices.map((invoice) => { const balance = Math.max(Number(invoice.totalAmount) - Number(invoice.paidAmount), 0); const lease = invoice.leaseBillingSchedule?.leaseContract; return <tr key={invoice.id} className="transition hover:bg-[#fffaf7]"><td className="px-5 py-4"><p className="font-semibold text-[#24130d]">{invoice.event?.name || `${lease?.hall?.name || 'Hall'} recurring use`}</p><p className="mt-1 text-[10px] uppercase tracking-wider text-[#947d72]">INV-{invoice.id.slice(0, 8).toUpperCase()} · {invoice.event?.contactName || lease?.contactName || 'No contact'}</p></td><td className="px-5 py-4 text-xs text-[#6f5d53]">{invoice.createdAt.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}</td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ${tone(invoice.status, 'financial')}`}>{label(invoice.status)}</span></td><td className="px-5 py-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase ring-1 ${tone(invoice.workflowStatus, 'workflow')}`}>{label(invoice.workflowStatus)}</span></td><td className="px-5 py-4 text-right"><p className="font-bold">{money(balance, invoice.currency)}</p><p className="mt-1 text-[10px] text-[#947d72]">of {money(Number(invoice.totalAmount), invoice.currency)}</p></td><td className="px-5 py-4 text-right"><ViewInvoiceButton invoiceId={invoice.id} /></td></tr>; })}</tbody></table></div><div className="flex items-center justify-between border-t border-[#eadfd8] bg-[#fffaf7] px-5 py-3 text-xs text-[#947d72]"><span>Showing {invoices.length} of {allInvoices.length} invoice{allInvoices.length === 1 ? '' : 's'}</span><Link href="/fnb/events/bookings" className="font-bold text-orange-700">Open event register <ChevronRight className="inline h-3 w-3" /></Link></div></section>
    </main>
  </div>;
}
