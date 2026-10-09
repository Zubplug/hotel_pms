import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { ArrowRight, CheckCircle2, ClipboardCheck, Clock3, DollarSign, Package, ShieldCheck, Truck } from 'lucide-react';
import FnbRequestActions from './FnbRequestActions';
import { POActionBar } from '../purchase-orders/[id]/ActionBar';

export const dynamic = 'force-dynamic';

export default async function InventoryApprovalsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const user = session.user as { role?: string; isSuperAdmin?: boolean };
  const propertyIds = (await requireOrganizationContext(session.user.id)).propertyIds;
  const role = String(user.role || '').toUpperCase();
  const isSuperAdmin = Boolean(user.isSuperAdmin);
  const canViewTransfers = role === 'STOCK_MANAGER' || isSuperAdmin;
  const canViewPurchaseOrders = ['ACCOUNTANT', 'GENERAL_MANAGER'].includes(role) || isSuperAdmin;

  if (!propertyIds.length || (!canViewTransfers && !canViewPurchaseOrders)) redirect('/inventory');

  // Department requisitions are deliberately restricted to Stock Manager. They
  // are operational custody requests, not Accountant/General Manager queues.
  const requests = canViewTransfers ? await prisma.stockTransfer.findMany({
    where: { propertyId: { in: propertyIds }, status: 'PENDING_APPROVAL' },
    include: {
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true, posOutlet: { select: { name: true } } } },
      items: { include: { stockItem: { select: { name: true, baseUnit: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  }) : [];

  const purchaseOrders = canViewPurchaseOrders ? await prisma.purchaseOrder.findMany({
    where: {
      propertyId: { in: propertyIds },
      status: 'SUBMITTED',
      ...(isSuperAdmin ? {} : role === 'ACCOUNTANT'
        ? { OR: [{ approvalStage: 'ACCOUNTANT' }, { approvalStage: null }] }
        : { approvalStage: 'GENERAL_MANAGER' }),
    },
    include: {
      supplier: { select: { name: true, contactName: true, phone: true, email: true } },
      property: { select: { baseCurrency: true } },
      items: true,
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
  }) : [];

  const poCanApprove = (approvalStage: string | null) => isSuperAdmin || (
    (approvalStage === 'ACCOUNTANT' && role === 'ACCOUNTANT') ||
    (approvalStage === 'GENERAL_MANAGER' && role === 'GENERAL_MANAGER')
  );

  return <div className="min-h-full bg-[#07101d] text-slate-100">
    <section className="relative overflow-hidden border-b border-white/[0.07] bg-[radial-gradient(circle_at_78%_-10%,rgba(245,158,11,.16),transparent_32%),radial-gradient(circle_at_10%_0%,rgba(16,185,129,.1),transparent_28%),linear-gradient(135deg,#0b1728,#07101d)] px-5 pb-8 pt-6 sm:px-8 sm:pt-8">
      <div className="pointer-events-none absolute -bottom-32 right-24 h-72 w-72 rounded-full bg-amber-300/[0.05] blur-3xl" />
      <div className="relative mx-auto max-w-[1360px]">
        <div className="mb-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500"><ClipboardCheck className="h-4 w-4 text-amber-300" /> Inventory <span className="text-slate-700">/</span> <span className="text-amber-300">Approvals</span></div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/20 bg-amber-300/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-amber-200"><ShieldCheck className="h-3.5 w-3.5" /> Approval control</div><h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Approval Control Center</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{canViewPurchaseOrders ? 'Review purchase-order invoices and record the current approval decision.' : 'Review F&B and Housekeeping stock requests, issue approved stock, and keep the movement trail visible.'}</p></div>
          {canViewTransfers && <Link href="/inventory/transfers" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/[0.1]"><Package className="h-4 w-4" />Open transfer register<ArrowRight className="h-3.5 w-3.5 text-slate-500" /></Link>}
        </div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-100/60">Needs review</p><Clock3 className="h-4 w-4 text-amber-300" /></div><p className="mt-3 text-3xl font-semibold text-amber-200">{canViewTransfers ? requests.length : purchaseOrders.length}</p><p className="mt-1 text-xs text-slate-500">{canViewTransfers ? 'Stock requests' : 'Purchase orders'}</p></div>
          {canViewTransfers && <><div className="rounded-2xl border border-violet-300/20 bg-violet-300/[0.07] p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-100/60">Custody scope</p><Truck className="h-4 w-4 text-violet-300" /></div><p className="mt-3 text-3xl font-semibold text-violet-200">Stock</p><p className="mt-1 text-xs text-slate-500">F&B and housekeeping</p></div><div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-100/60">Action owner</p><CheckCircle2 className="h-4 w-4 text-emerald-300" /></div><p className="mt-3 text-xl font-semibold text-emerald-200">Stock Manager</p><p className="mt-1 text-xs text-slate-500">Only this role sees requests</p></div></>}
          {canViewPurchaseOrders && <div className="rounded-2xl border border-cyan-300/20 bg-cyan-300/[0.07] p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-100/60">Approval stage</p><DollarSign className="h-4 w-4 text-cyan-300" /></div><p className="mt-3 text-xl font-semibold text-cyan-200">{role === 'ACCOUNTANT' ? 'Accountant' : 'General Manager'}</p><p className="mt-1 text-xs text-slate-500">Invoice review queue</p></div>}
        </div>
      </div>
    </section>

    {canViewPurchaseOrders && <main className="mx-auto max-w-[1360px] space-y-5 px-5 py-6 sm:px-8 lg:py-8">
      {purchaseOrders.length === 0 ? <div className="rounded-[24px] border border-white/[0.08] bg-[#111c2e] px-6 py-20 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" /><p className="mt-4 font-semibold text-slate-200">No purchase orders await your approval</p><p className="mt-1 text-sm text-slate-500">Submitted POs will appear here at their assigned approval stage.</p></div> : <section className="space-y-5"><div><h2 className="text-xl font-semibold text-white">Purchase-order invoices</h2><p className="mt-1 text-sm text-slate-500">Review supplier, line items, totals, and approval history before recording your decision.</p></div>{purchaseOrders.map((po) => <article key={po.id} className="overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#0e1a2c] shadow-[0_18px_55px_rgba(0,0,0,.14)]"><div className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-start sm:justify-between sm:px-6"><div><div className="flex flex-wrap items-center gap-3"><span className="font-mono text-sm font-bold text-cyan-200">{po.poNumber}</span><span className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold uppercase text-amber-300">Awaiting {po.approvalStage === 'ACCOUNTANT' ? 'Accountant' : 'General Manager'}</span></div><h2 className="mt-3 text-lg font-semibold text-white">{po.supplier.name}</h2><p className="mt-1 text-xs text-slate-500">Created {new Date(po.createdAt).toLocaleString('en-GB')} {po.supplier.contactName ? `· ${po.supplier.contactName}` : ''}</p></div><div className="text-left sm:text-right"><p className="text-xs uppercase tracking-[0.14em] text-slate-500">Invoice total</p><p className="mt-1 text-2xl font-semibold text-cyan-200">{po.property.baseCurrency} {Number(po.totalAmount).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</p></div></div><div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_auto] lg:items-end"><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="border-b border-white/[0.07] text-[10px] uppercase tracking-[0.14em] text-slate-600"><tr><th className="px-3 py-3">Item</th><th className="px-3 py-3 text-right">Qty</th><th className="px-3 py-3">Unit</th><th className="px-3 py-3 text-right">Unit price</th><th className="px-3 py-3 text-right">Line total</th></tr></thead><tbody className="divide-y divide-white/[0.06]">{po.items.map((item) => <tr key={item.id}><td className="px-3 py-3 font-medium text-slate-200">{item.description}</td><td className="px-3 py-3 text-right text-slate-300">{Number(item.quantity).toLocaleString()}</td><td className="px-3 py-3 text-slate-500">{item.unitOfMeasure}</td><td className="px-3 py-3 text-right text-slate-300">{Number(item.unitPrice).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td><td className="px-3 py-3 text-right font-semibold text-slate-200">{Number(item.totalPrice).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</td></tr>)}</tbody></table></div><div className="flex flex-col gap-3 lg:min-w-48"><POActionBar id={po.id} status={po.status} approvalStage={po.approvalStage} canApprove={poCanApprove(po.approvalStage)} /><Link href={`/inventory/purchase-orders/${po.id}`} className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-white/[0.06]">Open full PO <ArrowRight className="h-3.5 w-3.5" /></Link></div></div></article>)}</section>}
    </main>}

    {canViewTransfers && <main className="mx-auto max-w-[1360px] space-y-5 px-5 py-6 sm:px-8 lg:py-8">
      {requests.length === 0 ? <div className="rounded-[24px] border border-white/[0.08] bg-[#111c2e] px-6 py-20 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" /><p className="mt-4 font-semibold text-slate-200">No department requests in the queue</p><p className="mt-1 text-sm text-slate-500">F&B and housekeeping requisitions appear here for Stock Manager review.</p></div> : <section className="overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#0e1a2c] shadow-[0_18px_55px_rgba(0,0,0,.14)]"><div className="border-b border-white/[0.08] px-5 py-5 sm:px-6"><h2 className="text-base font-semibold text-white">F&B and Housekeeping requests</h2><p className="mt-1 text-xs text-slate-500">Visible only to Stock Manager.</p></div><div className="divide-y divide-white/[0.06]">{requests.map((request) => <article key={request.id} className="px-5 py-5 transition-colors hover:bg-white/[0.02] sm:px-6"><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-300" /><Link href={`/inventory/transfers/${request.id}`} className="font-mono text-xs font-bold tracking-wide text-slate-200 hover:text-white">{request.transferRef}</Link><span className="rounded-lg border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-[10px] font-bold text-amber-300">Pending approval</span></div><div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><span className="font-medium text-slate-300">{request.fromWarehouse.name}</span><ArrowRight className="h-3.5 w-3.5 text-slate-500" /><span className="font-semibold text-emerald-300">{request.toWarehouse.posOutlet?.name || request.toWarehouse.name}</span></div><div className="mt-1 text-xs text-slate-600">{request.items.length} item line{request.items.length === 1 ? '' : 's'} · {new Date(request.createdAt).toLocaleString('en-GB')}</div><div className="mt-4 flex flex-wrap gap-2">{request.items.slice(0, 6).map((item) => <span key={item.id} className="rounded-lg border border-white/[0.08] bg-[#142238] px-2.5 py-1.5 text-xs text-slate-400"><strong className="text-slate-100">{Number(item.quantity).toLocaleString()}</strong> {item.unitOfMeasure} · {item.stockItem.name}</span>)}</div></div><div className="flex flex-col items-start gap-3 border-t border-white/[0.07] pt-4 xl:items-end xl:border-t-0 xl:pt-0"><FnbRequestActions transferId={request.id} status={request.status} /><Link href={`/inventory/transfers/${request.id}`} className="text-xs text-slate-500 hover:text-white">Open request details</Link></div></div></article>)}</div></section>}
    </main>}
  </div>;
}
