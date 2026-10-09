import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@hotel-pms/db';
import { ArrowRight, CheckCircle2, ClipboardList, Clock3, FileSearch, ShieldCheck, Truck, ArrowDownToLine, Package } from 'lucide-react';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING_APPROVAL: { label: 'Pending approval', className: 'border-amber-400/20 bg-amber-400/10 text-amber-300' },
  APPROVED: { label: 'Approved', className: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300' },
  ISSUED: { label: 'In transit', className: 'border-violet-400/20 bg-violet-400/10 text-violet-300' },
  RECEIVED: { label: 'Received', className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' },
  COMPLETED: { label: 'Completed', className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' },
  REJECTED: { label: 'Rejected', className: 'border-rose-400/20 bg-rose-400/10 text-rose-300' },
};

function isDepartmentWarehouse(name: string) {
  return /housekeeping|laundry|linen|uniform|\bhk\b/i.test(name);
}

export default async function HousekeepingRequestTrackingPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const user = session.user as { propertyId?: string; role?: string; isSuperAdmin?: boolean; capabilities?: string[] };
  const propertyId = user.propertyId;
  const role = String(user.role || '').toUpperCase();
  const capabilities = user.capabilities || [];
  
  const isManager = role === 'HOUSEKEEPING_MANAGER' || role === 'HOUSEKEEPING_MAINTENANCE_MANAGER' || (capabilities.includes('ACCESS_HOUSEKEEPING') && capabilities.includes('ACCESS_MAINTENANCE'));
  if (!propertyId || (!isManager && !user.isSuperAdmin)) redirect('/housekeeping-manager');

  const allWarehouses = await prisma.warehouse.findMany({
    where: { propertyId, isActive: true },
    select: { id: true, name: true }
  });
  
  const hkWarehouseIds = allWarehouses.filter(w => isDepartmentWarehouse(w.name)).map(w => w.id);

  const requests = await prisma.stockTransfer.findMany({
    where: { 
      propertyId,
      OR: [
        { fromWarehouseId: { in: hkWarehouseIds } },
        { toWarehouseId: { in: hkWarehouseIds } }
      ]
    },
    include: {
      fromWarehouse: { select: { name: true } },
      toWarehouse: { select: { name: true, posOutlet: { select: { name: true } } } },
      items: { include: { stockItem: { select: { name: true, baseUnit: true } } } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  const pending = requests.filter((request) => request.status === 'PENDING_APPROVAL').length;
  const inTransit = requests.filter((request) => request.status === 'ISSUED').length;
  const completed = requests.filter((request) => ['RECEIVED', 'COMPLETED'].includes(request.status)).length;
  const rejected = requests.filter((request) => request.status === 'REJECTED').length;
  const totalLines = requests.reduce((total, request) => total + request.items.length, 0);

  return <div className="min-h-full bg-[#07101d] text-slate-100">
    <section className="relative overflow-hidden border-b border-white/[0.07] bg-[radial-gradient(circle_at_78%_-10%,rgba(34,211,238,.12),transparent_32%),radial-gradient(circle_at_10%_0%,rgba(16,185,129,.08),transparent_28%),linear-gradient(135deg,#0b1728,#07101d)] px-5 pb-8 pt-6 sm:px-8 sm:pt-8">
      <div className="pointer-events-none absolute -bottom-32 right-24 h-72 w-72 rounded-full bg-cyan-400/[0.05] blur-3xl" />
      <div className="relative mx-auto max-w-[1360px]">
        <div className="mb-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500"><FileSearch className="h-4 w-4 text-cyan-300" /> Housekeeping <span className="text-slate-700">/</span> <span className="text-cyan-300">Requests</span></div>
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-200"><ClipboardList className="h-3.5 w-3.5" /> Requisition tracking</div><h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Request Tracking</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">Monitor the real-time status of all your department requisitions. Track approvals, watch items in transit, and confirm successful deliveries.</p></div><Link href="/housekeeping-manager/inventory" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/[0.1]"><Package className="h-4 w-4" />Back to inventory<ArrowRight className="h-3.5 w-3.5 text-slate-500" /></Link></div>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-amber-300/20 bg-amber-300/[0.07] p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-amber-100/60">Awaiting approval</p><Clock3 className="h-4 w-4 text-amber-300" /></div><p className="mt-3 text-3xl font-semibold text-amber-200">{pending}</p><p className="mt-1 text-xs text-slate-500">Pending finance review</p></div><div className="rounded-2xl border border-violet-300/20 bg-violet-300/[0.07] p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-violet-100/60">In transit</p><Truck className="h-4 w-4 text-violet-300" /></div><p className="mt-3 text-3xl font-semibold text-violet-200">{inTransit}</p><p className="mt-1 text-xs text-slate-500">En route from main store</p></div><div className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.07] p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-emerald-100/60">Reconciled</p><CheckCircle2 className="h-4 w-4 text-emerald-300" /></div><p className="mt-3 text-3xl font-semibold text-emerald-200">{completed}</p><p className="mt-1 text-xs text-slate-500">Received or completed</p></div><div className="rounded-2xl border border-white/[0.1] bg-white/[0.04] p-4"><div className="flex items-center justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">Queue volume</p><ArrowDownToLine className="h-4 w-4 text-cyan-300" /></div><p className="mt-3 text-3xl font-semibold text-white">{totalLines}</p><p className="mt-1 text-xs text-slate-500">Lines across {requests.length} requests{rejected ? ` · ${rejected} rejected` : ''}</p></div></div>
      </div>
    </section>
    <main className="mx-auto max-w-[1360px] space-y-5 px-5 py-6 sm:px-8 lg:py-8">
      {requests.length === 0 ? <div className="rounded-[24px] border border-white/[0.08] bg-[#111c2e] px-6 py-20 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" /><p className="mt-4 font-semibold text-slate-200">No requests in the queue</p><p className="mt-1 text-sm text-slate-500">Your department requisitions will appear here when submitted.</p></div> : <section className="overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#0e1a2c] shadow-[0_18px_55px_rgba(0,0,0,.14)]"><div className="flex flex-col gap-4 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div><div className="flex items-center gap-2"><p className="text-base font-semibold text-white">Department requisition history</p><span className="rounded-full bg-white/[0.07] px-2 py-0.5 text-[10px] font-bold text-slate-400">{requests.length}</span></div><p className="mt-1 text-xs text-slate-500">Monitor the status of your requests as they move through the fulfillment pipeline.</p></div><div className="flex items-center gap-2 text-xs text-slate-500"><span className="h-2 w-2 rounded-full bg-cyan-300" /> Read-only tracking view</div></div><div className="divide-y divide-white/[0.06]">{requests.map((request) => { const meta = STATUS[request.status] || { label: request.status, className: 'border-white/10 bg-white/[0.04] text-slate-400' }; const visibleItems = request.items.slice(0, 4); const remaining = request.items.length - visibleItems.length; return <article key={request.id} className="group px-5 py-5 transition-colors hover:bg-white/[0.02] sm:px-6 sm:py-6"><div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`h-2 w-2 rounded-full ${request.status === 'PENDING_APPROVAL' ? 'bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,.7)]' : request.status === 'ISSUED' ? 'bg-violet-300' : request.status === 'REJECTED' ? 'bg-rose-300' : 'bg-emerald-300'}`} /><span className="font-mono text-xs font-bold tracking-wide text-slate-200 transition-colors">{request.transferRef}</span><span className={`rounded-lg border px-2.5 py-1 text-[10px] font-bold ${meta.className}`}>{meta.label}</span><span className="text-[11px] text-slate-600">{new Date(request.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span></div><div className="mt-4 flex flex-wrap items-center gap-2 text-sm"><span className="font-medium text-slate-300">{request.fromWarehouse.name}</span><span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]"><ArrowRight className="h-3 w-3 text-slate-500" /></span><span className="font-semibold text-cyan-300">{request.toWarehouse.posOutlet?.name || request.toWarehouse.name}</span></div><div className="mt-1 text-xs text-slate-600">{new Date(request.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} · {request.items.length} item line{request.items.length === 1 ? '' : 's'} · {hkWarehouseIds.includes(request.toWarehouseId) ? 'inflow' : 'outflow'}</div><div className="mt-5 flex flex-wrap gap-2">{visibleItems.map((item) => <span key={item.id} className="inline-flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#142238] px-2.5 py-1.5 text-xs text-slate-400"><strong className="text-slate-100">{Number(item.quantity).toLocaleString()}</strong><span className="text-slate-600">{item.unitOfMeasure}</span><span className="max-w-[180px] truncate">{item.stockItem.name}</span></span>)}{remaining > 0 && <span className="inline-flex items-center rounded-lg border border-dashed border-white/[0.12] px-2.5 py-1.5 text-xs font-semibold text-slate-500">+{remaining} more items</span>}</div></div></div></article>; })}</div></section>}
    </main>
  </div>;
}
