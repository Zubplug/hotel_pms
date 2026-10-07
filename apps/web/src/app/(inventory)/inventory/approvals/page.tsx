import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import prisma from '@hotel-pms/db';
import { ArrowRight, CheckCircle2, ClipboardCheck, Package } from 'lucide-react';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import FnbRequestActions from './FnbRequestActions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, { label: string; className: string }> = {
  PENDING_APPROVAL: { label: 'Pending approval', className: 'border-amber-400/20 bg-amber-400/10 text-amber-300' },
  APPROVED: { label: 'Approved', className: 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300' },
  ISSUED: { label: 'In transit', className: 'border-violet-400/20 bg-violet-400/10 text-violet-300' },
  RECEIVED: { label: 'Received', className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' },
  COMPLETED: { label: 'Completed', className: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300' },
  REJECTED: { label: 'Rejected', className: 'border-rose-400/20 bg-rose-400/10 text-rose-300' },
};

export default async function InventoryApprovalsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const user = session.user as { propertyId?: string; role?: string; isSuperAdmin?: boolean };
  const propertyId = user.propertyId;
  const role = String(user.role || '');
  if (!propertyId || (!hasInventoryPermission(role, 'inventory.transfer.approve', user.isSuperAdmin) && !hasInventoryPermission(role, 'inventory.transfer.issue', user.isSuperAdmin))) redirect('/inventory');

  const requests = await prisma.stockTransfer.findMany({
    where: { propertyId, toWarehouse: { posOutletId: { not: null } }, status: { notIn: ['DRAFT', 'CANCELLED'] } },
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

  return <div className="min-h-full bg-[#08111f] text-slate-100">
    <section className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.15),_transparent_36%),linear-gradient(135deg,#0b1728,#08111f)] px-5 py-8 sm:px-8">
      <div className="mx-auto max-w-[1500px]">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div><div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300"><ClipboardCheck className="h-4 w-4" /> Inventory approval control</div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">F&B requests</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">One queue for outlet requisitions from request through approval, issue, and receipt. Approving a request does not change outlet stock until stock is issued.</p></div>
          <Link href="/inventory/transfers" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.08]"><Package className="h-4 w-4" />Open transfer register</Link>
        </div>
        <div className="mt-7 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-amber-400/15 bg-amber-400/[0.05] p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Awaiting approval</p><p className="mt-2 text-2xl font-semibold text-amber-300">{pending}</p></div><div className="rounded-xl border border-violet-400/15 bg-violet-400/[0.05] p-4"><p className="text-xs uppercase tracking-wider text-slate-500">In transit</p><p className="mt-2 text-2xl font-semibold text-violet-300">{inTransit}</p></div><div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[0.05] p-4"><p className="text-xs uppercase tracking-wider text-slate-500">Completed</p><p className="mt-2 text-2xl font-semibold text-emerald-300">{completed}</p></div></div>
      </div>
    </section>
    <main className="mx-auto max-w-[1500px] space-y-5 px-5 py-6 sm:px-8">
      {requests.length === 0 ? <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] px-6 py-20 text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" /><p className="mt-4 font-semibold text-slate-200">No F&B requests in the queue</p><p className="mt-1 text-sm text-slate-500">Outlet requisitions will appear here when submitted.</p></div> : <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111c2e]"><div className="border-b border-white/[0.07] px-5 py-4"><p className="text-sm font-semibold text-white">Outlet requisition queue</p><p className="mt-1 text-xs text-slate-500">{requests.length} request{requests.length === 1 ? '' : 's'} across all outlet warehouses</p></div><div className="divide-y divide-white/[0.06]">{requests.map((request) => { const meta = STATUS[request.status] || { label: request.status, className: 'border-white/10 bg-white/[0.04] text-slate-400' }; return <article key={request.id} className="px-5 py-5"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><Link href={`/inventory/transfers/${request.id}`} className="font-mono text-sm font-bold text-violet-200 hover:text-white">{request.transferRef}</Link><span className={`rounded-lg border px-2 py-1 text-[11px] font-semibold ${meta.className}`}>{meta.label}</span></div><div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-300"><span>{request.fromWarehouse.name}</span><ArrowRight className="h-3.5 w-3.5 text-slate-600" /><span className="text-emerald-300">{request.toWarehouse.posOutlet?.name || request.toWarehouse.name}</span><span className="text-xs text-slate-600">· {new Date(request.createdAt).toLocaleString('en-GB')}</span></div><div className="mt-3 flex flex-wrap gap-2">{request.items.map((item) => <span key={item.id} className="rounded-lg border border-white/[0.07] bg-white/[0.025] px-2.5 py-1.5 text-xs text-slate-400"><strong className="text-slate-200">{Number(item.quantity).toLocaleString()}</strong> {item.unitOfMeasure} {item.stockItem.name} ({item.stockItem.baseUnit})</span>)}</div></div><div className="flex shrink-0 items-center justify-end gap-3"><FnbRequestActions transferId={request.id} status={request.status} /><Link href={`/inventory/transfers/${request.id}`} className="rounded-lg p-2 text-slate-500 hover:bg-white/[0.05] hover:text-white" aria-label={`Open ${request.transferRef}`}><ArrowRight className="h-4 w-4" /></Link></div></div></article>; })}</div></div>}
    </main>
  </div>;
}
