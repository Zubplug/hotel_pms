import React from 'react';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, ArrowRight, CheckCircle2, FileText } from 'lucide-react';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@hotel-pms/db';

const money = (value: number, currency: string) => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const date = (value: Date) => new Intl.DateTimeFormat('en-NG', { dateStyle: 'medium' }).format(value);
const age = (dueDate: Date, now: number) => Math.max(0, Math.floor((now - dueDate.getTime()) / 86_400_000));

export default async function OpenInvoicesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login?callbackUrl=%2Faccountant%2Fcity-ledger%2Finvoices');
  const propertyId = session.user.propertyId;
  if (!propertyId) return <EmptyState title="No property assigned" message="Your user account is not assigned to a property." />;

  const [property, invoices] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true } }),
    prisma.cityLedgerInvoice.findMany({ where: { propertyId, status: { in: ['OPEN', 'PARTIALLY_PAID'] } }, include: { account: { select: { id: true, name: true, type: true, currency: true } } }, orderBy: [{ dueDate: 'asc' }, { issueDate: 'asc' }] }),
  ]);
  const currency = property?.baseCurrency || invoices[0]?.currency || 'NGN';
  const asAt = new Date();
  const now = asAt.getTime();
  const overdue = invoices.filter(invoice => invoice.dueDate.getTime() < now);
  const overdueAmount = overdue.reduce((sum, invoice) => sum + Number(invoice.outstandingAmount), 0);
  const totalOpen = invoices.reduce((sum, invoice) => sum + Number(invoice.outstandingAmount), 0);
  const dueSoon = invoices.filter(invoice => invoice.dueDate.getTime() >= now && invoice.dueDate.getTime() <= now + 7 * 86_400_000).reduce((sum, invoice) => sum + Number(invoice.outstandingAmount), 0);

  return <main className="min-h-screen bg-[#07111f] p-5 text-slate-100 md:p-8"><div className="mx-auto max-w-[1400px] space-y-6"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><Link href="/accountant/city-ledger" className="mb-4 inline-flex items-center gap-2 text-xs text-cyan-300 hover:text-cyan-200"><ArrowLeft className="h-3.5 w-3.5" />Back to city ledger</Link><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.22em] text-cyan-300"><FileText className="h-4 w-4" />Invoice register</div><h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">Open invoices</h1><p className="mt-2 text-sm text-slate-400">Full city-ledger invoice register with contractual due dates, ageing, and direct account settlement paths for {property?.name || 'this property'}.</p></div><div className="rounded-xl border border-white/10 bg-white/[.04] px-4 py-2 text-xs text-slate-400">As at <span className="ml-1 font-medium text-slate-200">{date(asAt)}</span></div></div>
    <section className="grid gap-4 sm:grid-cols-3"><Stat title="Open exposure" value={money(totalOpen, currency)} detail={`${invoices.length} active invoices`} /><Stat title="Overdue" value={money(overdueAmount, currency)} detail={`${overdue.length} invoices past due`} tone="rose" /><Stat title="Due next 7 days" value={money(dueSoon, currency)} detail="Collection planning window" tone="amber" /></section>
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[.035]"><div className="border-b border-white/10 p-5"><h2 className="font-semibold text-white">Invoice ageing register</h2><p className="mt-1 text-xs text-slate-500">Settlement is performed from the account detail page so every payment is allocated to a specific invoice.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-950/40 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-medium">Invoice</th><th className="px-5 py-3 font-medium">Account</th><th className="px-5 py-3 font-medium">Issue date</th><th className="px-5 py-3 font-medium">Due date</th><th className="px-5 py-3 font-medium">Status</th><th className="px-5 py-3 text-right font-medium">Outstanding</th><th className="px-5 py-3 text-right font-medium">Action</th></tr></thead><tbody className="divide-y divide-white/[.07]">{invoices.length ? invoices.map(invoice => { const days = age(invoice.dueDate, now); const isOverdue = invoice.dueDate.getTime() < now; return <tr key={invoice.id} className="hover:bg-white/[.025]"><td className="px-5 py-4"><span className="font-medium text-slate-200">{invoice.invoiceNumber}</span><span className="mt-1 block text-xs text-slate-500">{invoice.description}</span></td><td className="px-5 py-4"><Link href={`/accountant/city-ledger/${invoice.account.id}`} className="text-cyan-300 hover:text-cyan-200">{invoice.account.name}</Link><span className="mt-1 block text-xs text-slate-500">{invoice.account.type}</span></td><td className="px-5 py-4 text-slate-400">{date(invoice.issueDate)}</td><td className={`px-5 py-4 ${isOverdue ? 'text-rose-300' : 'text-slate-400'}`}>{date(invoice.dueDate)}</td><td className="px-5 py-4"><span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold ${isOverdue ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'}`}>{isOverdue ? <AlertCircle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}{isOverdue ? `${days}d overdue` : invoice.status}</span></td><td className="px-5 py-4 text-right font-semibold text-slate-100">{money(Number(invoice.outstandingAmount), invoice.currency || currency)}</td><td className="px-5 py-4 text-right"><Link href={`/accountant/city-ledger/${invoice.account.id}`} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">Open account <ArrowRight className="ml-1 inline h-3.5 w-3.5" /></Link></td></tr>; }) : <tr><td colSpan={7} className="py-16 text-center text-slate-500">No open invoices. All city-ledger invoices are settled.</td></tr>}</tbody></table></div></section></div></main>;
}

function Stat({ title, value, detail, tone = 'cyan' }: { title: string; value: string; detail: string; tone?: 'cyan' | 'rose' | 'amber' }) { const color = tone === 'rose' ? 'text-rose-300 border-rose-300/15' : tone === 'amber' ? 'text-amber-300 border-amber-300/15' : 'text-cyan-300 border-cyan-300/15'; return <div className={`rounded-2xl border bg-white/[.035] p-5 ${color}`}><p className="text-xs uppercase tracking-wider text-slate-500">{title}</p><p className="mt-4 text-2xl font-semibold text-white">{value}</p><p className="mt-2 text-xs text-slate-500">{detail}</p></div>; }
function EmptyState({ title, message }: { title: string; message: string }) { return <div className="flex min-h-screen items-center justify-center bg-[#07111f] p-8 text-center text-slate-300"><div><FileText className="mx-auto mb-3 h-10 w-10 text-slate-500" /><h1 className="text-xl font-semibold text-white">{title}</h1><p className="mt-2 text-sm text-slate-400">{message}</p></div></div>; }
