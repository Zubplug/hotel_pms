import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle, ArrowRight, BadgeCheck, Building2, CheckCircle2, ClipboardCheck,
  FileText, Mail, PackageCheck, Phone, Plus, Receipt, ShieldCheck, ShoppingCart,
  Truck, Users, WalletCards,
} from 'lucide-react';
import { AddSupplierDialog } from './AddSupplierDialog';

export const dynamic = 'force-dynamic';

const OPEN_PO_STATUSES = ['SUBMITTED', 'APPROVED', 'PARTIALLY_RECEIVED'];
const money = (value: number, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
const dateLabel = (value: Date) => value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const initials = (name: string) => name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();

type Tone = 'emerald' | 'cyan' | 'amber' | 'rose' | 'violet';
const toneClasses = (tone: Tone) => tone === 'emerald' ? 'bg-emerald-400/10 text-emerald-300' : tone === 'cyan' ? 'bg-cyan-400/10 text-cyan-300' : tone === 'amber' ? 'bg-amber-400/10 text-amber-300' : tone === 'rose' ? 'bg-rose-400/10 text-rose-300' : 'bg-violet-400/10 text-violet-300';

export default async function SuppliersPage() {
  const session = await auth();
  const propertyId = session?.user?.propertyId;
  if (!propertyId) return <div className="p-8 text-sm text-slate-400">No property selected.</div>;

  const suppliers = await prisma.supplier.findMany({
    where: { propertyId },
    include: {
      purchaseOrders: { include: { items: true, grns: { select: { id: true, status: true } } } },
      supplierInvoices: { include: { payments: true, grnLinks: { select: { id: true } } } },
    },
    orderBy: { name: 'asc' },
  });
  const now = new Date();
  const rows = suppliers.map((supplier) => {
    const openPOs = supplier.purchaseOrders.filter((po) => OPEN_PO_STATUSES.includes(po.status));
    const openCommitment = openPOs.reduce((sum, po) => sum + Number(po.totalAmount || 0), 0);
    const overduePOs = openPOs.filter((po) => po.expectedDate && new Date(po.expectedDate) < now);
    const invoices = supplier.supplierInvoices;
    const outstanding = invoices.reduce((sum, invoice) => sum + Number(invoice.outstandingAmount || 0), 0);
    const overdueInvoices = invoices.filter((invoice) => Number(invoice.outstandingAmount || 0) > 0 && new Date(invoice.dueDate) < now);
    const invoiceValue = invoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount || 0), 0);
    const matchedInvoices = invoices.filter((invoice) => invoice.grnLinks.length > 0).length;
    const receivedValue = supplier.purchaseOrders.reduce((sum, po) => sum + po.items.reduce((lineSum, item) => lineSum + Number(item.receivedQty || 0) * Number(item.unitPrice || 0), 0), 0);
    const orderedValue = supplier.purchaseOrders.reduce((sum, po) => sum + Number(po.totalAmount || 0), 0);
    return { supplier, openPOs, openCommitment, overduePOs, invoices, outstanding, overdueInvoices, invoiceValue, matchedInvoices, receivedValue, orderedValue };
  });
  const active = rows.filter((row) => row.supplier.isActive);
  const openCommitment = rows.reduce((sum, row) => sum + row.openCommitment, 0);
  const apExposure = rows.reduce((sum, row) => sum + row.outstanding, 0);
  const overdueSuppliers = rows.filter((row) => row.overduePOs.length || row.overdueInvoices.length);
  const approvalBacklog = rows.reduce((sum, row) => sum + row.supplier.purchaseOrders.filter((po) => po.status === 'SUBMITTED').length, 0);
  const invoiceCount = rows.reduce((sum, row) => sum + row.invoices.length, 0);
  const matchedInvoices = rows.reduce((sum, row) => sum + row.matchedInvoices, 0);
  const committedCurrency = rows.find((row) => row.openPOs[0])?.openPOs[0]?.currency || 'NGN';
  const topExposure = [...rows].sort((a, b) => b.openCommitment - a.openCommitment).slice(0, 6);
  const maxExposure = Math.max(...topExposure.map((row) => row.openCommitment), 1);
  const kpis: { label: string; value: string; detail: string; icon: LucideIcon; tone: Tone }[] = [
    { label: 'Active suppliers', value: String(active.length), detail: `${suppliers.length} total records`, icon: Users, tone: 'emerald' },
    { label: 'Open commitment', value: money(openCommitment, committedCurrency), detail: `${rows.reduce((sum, row) => sum + row.openPOs.length, 0)} active purchase orders`, icon: ShoppingCart, tone: 'cyan' },
    { label: 'AP exposure', value: money(apExposure), detail: `${invoiceCount} supplier invoices`, icon: WalletCards, tone: 'violet' },
    { label: 'Control exceptions', value: String(overdueSuppliers.length), detail: 'Suppliers with overdue PO or invoice risk', icon: AlertTriangle, tone: overdueSuppliers.length ? 'rose' : 'emerald' },
    { label: 'Match coverage', value: invoiceCount ? `${Math.round(matchedInvoices / invoiceCount * 100)}%` : '—', detail: 'Invoices linked to a GRN', icon: ShieldCheck, tone: invoiceCount && matchedInvoices < invoiceCount ? 'amber' : 'emerald' },
  ];

  return <div className="min-h-full bg-[#08111f] text-slate-100">
    <section className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.14),_transparent_34%),linear-gradient(135deg,#0b1728,#08111f)] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div><div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300"><Building2 className="h-4 w-4" /> Supplier command centre</div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Suppliers</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">Protect purchasing quality from supplier onboarding through PO commitment, receipt confirmation, invoice matching, and payment readiness.</p></div>
          <div className="flex flex-wrap gap-2"><AddSupplierDialog /><Link href="/inventory/purchase-orders/new" className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/15 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/25"><Plus className="h-4 w-4" /> New purchase order</Link><Link href="/accountant/payables" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.08]"><FileText className="h-4 w-4" /> AP register</Link></div>
        </div>
        <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />Live property supplier register</span><span>As at {dateLabel(now)}</span><span>Three-way control: PO · receipt · invoice</span></div>
      </div>
    </section>

    <main className="mx-auto max-w-[1500px] space-y-6 px-5 py-6 sm:px-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{kpis.map(({ label, value, detail, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p><div className={`rounded-xl p-2 ${toneClasses(tone)}`}><Icon className="h-4 w-4" /></div></div><p className="mt-5 text-2xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div>)}</div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Supplier exposure</p><p className="mt-1 text-xs text-slate-500">Open purchase-order commitment by supplier</p></div><ShoppingCart className="h-4 w-4 text-slate-500" /></div><div className="mt-6 space-y-4">{topExposure.map((row) => <div key={row.supplier.id}><div className="mb-2 flex items-center justify-between gap-3"><Link href={`/inventory/purchase-orders?supplierId=${row.supplier.id}`} className="truncate text-sm text-slate-300 hover:text-cyan-200">{row.supplier.name}</Link><span className="shrink-0 text-xs font-semibold text-slate-300">{money(row.openCommitment, row.openPOs[0]?.currency || committedCurrency)}</span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${row.openCommitment ? Math.max(row.openCommitment / maxExposure * 100, 2) : 0}%` }} /></div></div>)}{topExposure.length === 0 && <p className="py-8 text-sm text-slate-500">No open supplier commitments.</p>}</div></section>
        <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Procurement controls</p><p className="mt-1 text-xs text-slate-500">Decisions that need an owner</p></div><ClipboardCheck className="h-4 w-4 text-slate-500" /></div><div className="mt-5 space-y-3"><Link href="/inventory/purchase-orders?status=SUBMITTED" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 hover:bg-white/[0.05]"><span className="flex items-center gap-3 text-sm text-slate-300"><ClipboardCheck className="h-4 w-4 text-amber-300" />Orders awaiting approval</span><span className={`font-bold ${approvalBacklog ? 'text-amber-300' : 'text-slate-500'}`}>{approvalBacklog}</span></Link><Link href="/inventory/grns" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 hover:bg-white/[0.05]"><span className="flex items-center gap-3 text-sm text-slate-300"><Truck className="h-4 w-4 text-cyan-300" />Receiving and delivery review</span><ArrowRight className="h-4 w-4 text-slate-600" /></Link><Link href="/accountant/payables" className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 hover:bg-white/[0.05]"><span className="flex items-center gap-3 text-sm text-slate-300"><Receipt className="h-4 w-4 text-violet-300" />Invoice matching and AP</span><span className={`font-bold ${invoiceCount - matchedInvoices ? 'text-amber-300' : 'text-emerald-300'}`}>{invoiceCount - matchedInvoices || 'Clear'}</span></Link><div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-3 text-xs leading-5 text-emerald-100"><ShieldCheck className="mr-1 inline h-4 w-4 text-emerald-300" />Invoices should be reviewed against purchase order and goods receipt before payment. Unmatched records remain visible for controlled review.</div></div></section>
      </div>

      <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111c2e]"><div className="border-b border-white/[0.07] px-5 py-5"><div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-sm font-semibold text-white">Supplier register</p><p className="mt-1 text-xs text-slate-500">Live master data with commitment, delivery, AP exposure, and control coverage.</p></div><span className="text-xs text-slate-600">{suppliers.length} supplier records · {active.length} active</span></div></div>{suppliers.length === 0 ? <div className="flex flex-col items-center justify-center px-6 py-20 text-center"><div className="rounded-2xl bg-cyan-400/10 p-4 text-cyan-300"><Building2 className="h-8 w-8" /></div><p className="mt-4 text-sm font-semibold text-slate-300">No suppliers yet</p><p className="mt-1 text-sm text-slate-500">Add a supplier to begin a controlled procurement cycle.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[1300px] text-sm"><thead><tr className="border-b border-white/[0.07] text-left text-[10px] uppercase tracking-[0.14em] text-slate-600">{['Supplier', 'Contact', 'Open commitment', 'Delivery risk', 'AP exposure', 'Match coverage', ''].map((heading) => <th key={heading} className={`px-5 py-3 font-semibold ${['Open commitment', 'Delivery risk', 'AP exposure', 'Match coverage', ''].includes(heading) ? 'text-right' : ''}`}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-white/[0.06]">{rows.map((row) => { const match = row.invoices.length ? Math.round(row.matchedInvoices / row.invoices.length * 100) : null; const risk = row.overduePOs.length + row.overdueInvoices.length; return <tr key={row.supplier.id} className="group hover:bg-white/[0.025]"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-400/10 text-xs font-bold text-cyan-200">{initials(row.supplier.name)}</div><div><Link href={`/inventory/purchase-orders?supplierId=${row.supplier.id}`} className="font-semibold text-slate-200 hover:text-cyan-200">{row.supplier.name}</Link><p className="mt-1 text-[11px] text-slate-600">{row.supplier.isActive ? 'Active supplier' : 'Inactive supplier'} · {row.supplier.purchaseOrders.length} POs · {row.invoices.length} invoices</p></div></div></td><td className="px-5 py-4"><div className="space-y-1 text-xs text-slate-500">{row.supplier.contactName && <span className="block text-slate-300">{row.supplier.contactName}</span>}{row.supplier.email && <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{row.supplier.email}</span>}{row.supplier.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{row.supplier.phone}</span>}</div></td><td className="px-5 py-4 text-right"><span className="font-semibold text-slate-100">{money(row.openCommitment, row.openPOs[0]?.currency || committedCurrency)}</span><p className="mt-1 text-[11px] text-slate-600">{row.openPOs.length} open order{row.openPOs.length === 1 ? '' : 's'}</p></td><td className="px-5 py-4 text-right">{risk ? <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-400/20 bg-rose-400/10 px-2.5 py-1 text-xs font-semibold text-rose-300"><AlertTriangle className="h-3 w-3" />{risk} exception{risk === 1 ? '' : 's'}</span> : <span className="inline-flex items-center gap-1.5 text-xs text-emerald-300"><BadgeCheck className="h-3.5 w-3.5" />On track</span>}</td><td className="px-5 py-4 text-right"><span className={`font-semibold ${row.outstanding ? 'text-amber-200' : 'text-slate-400'}`}>{money(row.outstanding)}</span><p className="mt-1 text-[11px] text-slate-600">{row.overdueInvoices.length ? `${row.overdueInvoices.length} overdue` : 'No overdue invoices'}</p></td><td className="px-5 py-4 text-right">{match === null ? <span className="text-xs text-slate-600">No invoices</span> : <span className={`font-semibold ${match === 100 ? 'text-emerald-300' : 'text-amber-300'}`}>{match}%<p className="mt-1 text-[11px] font-normal text-slate-600">{row.matchedInvoices}/{row.invoices.length} linked to GRN</p></span>}</td><td className="px-5 py-4 text-right"><Link href={`/inventory/purchase-orders?supplierId=${row.supplier.id}`} className="inline-flex items-center gap-1 rounded-lg p-2 text-xs font-semibold text-cyan-300 opacity-0 transition group-hover:opacity-100 hover:bg-cyan-400/10">Open orders <ArrowRight className="h-3.5 w-3.5" /></Link></td></tr>; })}</tbody></table></div>}</section>

      <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><PackageCheck className="h-4 w-4 text-violet-300" /><p className="mt-3 text-sm font-semibold text-slate-200">Receipt confidence</p><p className="mt-1 text-xs leading-5 text-slate-500">{money(rows.reduce((sum, row) => sum + row.receivedValue, 0))} of {money(rows.reduce((sum, row) => sum + row.orderedValue, 0))} ordered value has receipt quantities recorded.</p></div><div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><ShieldCheck className="h-4 w-4 text-emerald-300" /><p className="mt-3 text-sm font-semibold text-slate-200">Three-way matching</p><p className="mt-1 text-xs leading-5 text-slate-500">Supplier invoice links are measured against posted or recorded GRNs before AP settlement.</p></div><div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><Building2 className="h-4 w-4 text-cyan-300" /><p className="mt-3 text-sm font-semibold text-slate-200">Master-data hygiene</p><p className="mt-1 text-xs leading-5 text-slate-500">Keep tax identifiers, contacts, and supplier status current before issuing new commitments.</p></div></div>
    </main>
  </div>;
}
