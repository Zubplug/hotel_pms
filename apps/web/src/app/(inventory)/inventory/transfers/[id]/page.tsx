import React from 'react';
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import prisma from '@hotel-pms/db';
import TransferActionBar from './TransferActionBar';
import TransferQuantityEditor from './TransferQuantityEditor';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import {
  ArrowLeftRight, ArrowRight, Boxes, CheckCircle2,
  Clock3, Package, Truck, Warehouse,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

const STATUS_META: Record<string, { label: string; tone: string }> = {
  DRAFT:            { label: 'Draft',            tone: 'slate' },
  PENDING_APPROVAL: { label: 'Pending approval', tone: 'amber' },
  APPROVED:         { label: 'Approved',         tone: 'cyan' },
  ISSUED:           { label: 'In transit',       tone: 'violet' },
  RECEIVED:         { label: 'Received',         tone: 'emerald' },
  COMPLETED:        { label: 'Completed',        tone: 'emerald' },
  CANCELLED:        { label: 'Cancelled',        tone: 'rose' },
  REJECTED:         { label: 'Rejected',         tone: 'rose' },
};

const toneClasses = (tone: string) => ({
  slate:   'border-white/10 bg-white/[0.04] text-slate-500',
  amber:   'border-amber-400/20 bg-amber-400/10 text-amber-300',
  cyan:    'border-cyan-400/20 bg-cyan-400/10 text-cyan-300',
  violet:  'border-violet-400/20 bg-violet-400/10 text-violet-300',
  emerald: 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300',
  rose:    'border-rose-400/20 bg-rose-400/10 text-rose-300',
}[tone] || 'border-white/10 bg-white/[0.04] text-slate-500');

const dateLabel = (d: Date) => d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const money     = (v: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(v);

export default async function TransferDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const { id }          = await params;
  const { propertyId, role, isSuperAdmin, id: userId } = session.user as any;
  const normalizedRole  = String(role || '').toUpperCase();

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: {
      fromWarehouse: { select: { name: true, posOutlet: { select: { name: true } } } },
      toWarehouse:   { select: { name: true, posOutlet: { select: { name: true } } } },
      items: {
        include: {
          stockItem: { select: { name: true, stockType: true, baseUnit: true, quantityOnHand: true, costPrice: true, stockUnits: { where: { isPurchaseUnit: true }, select: { unit: true, unitsInBase: true } } } },
        },
      },
    },
  });

  if (!transfer || transfer.propertyId !== propertyId) notFound();

  const isOutletBound  = Boolean(transfer.toWarehouse.posOutlet);
  const isStockStaff   = ['STOCK_MANAGER', 'STOCK_KEEPER'].includes(normalizedRole);
  const isFnbMgr       = normalizedRole === 'FNB_MANAGER';
  const isTopMgmt      = hasInventoryPermission(role, 'inventory.transfer.approve', isSuperAdmin) && !isStockStaff;

  // Can approve: Stock Manager approves outlet-bound requests; management approves general transfers
  const canApprove = isStockStaff || isTopMgmt || isSuperAdmin;

  // Can issue / post stock (after approval)
  const canIssue = hasInventoryPermission(role, 'inventory.transfer.issue', isSuperAdmin);

  // Can receive (confirm receipt):
  // FNB Manager for their own requests; top management for Stock-Manager-initiated transfers
  const canReceive = hasInventoryPermission(role, 'inventory.transfer.receive', isSuperAdmin);
  const canReduceRequest = isOutletBound && canApprove && ['PENDING_APPROVAL', 'APPROVED'].includes(transfer.status);

  const totalValue = transfer.items.reduce(
    (sum, item) => sum + Number(item.baseQuantity || item.quantity) * Number(item.stockItem.costPrice ?? 0), 0,
  );

  const meta = STATUS_META[transfer.status] || STATUS_META.DRAFT;

  return (
    <div className="min-h-full bg-[#08111f] text-slate-100">
      {/* ── header ──────────────────────────────────────────────────── */}
      <section className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_right,_rgba(139,92,246,0.14),_transparent_36%),linear-gradient(135deg,#0b1728,#08111f)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-300">
            <ArrowLeftRight className="h-4 w-4" /> Stock transfer
          </div>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-mono text-3xl font-semibold tracking-tight text-white">{transfer.transferRef}</h1>
                <span className={`inline-flex rounded-lg border px-3 py-1 text-sm font-semibold ${toneClasses(meta.tone)}`}>
                  {meta.label}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-400">
                {transfer.fromWarehouse.name}
                <span className="mx-2 text-slate-600">→</span>
                {isOutletBound ? <><span className="text-emerald-300">Outlet:</span> {transfer.toWarehouse.posOutlet?.name}</> : transfer.toWarehouse.name}
              </p>
            </div>
            <TransferActionBar
              transferId={transfer.id}
              status={transfer.status}
              canApprove={canApprove}
              canIssue={canIssue}
              canReceive={canReceive}
              isOutletBound={isOutletBound}
              isFnbMgr={isFnbMgr}
            />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl space-y-6 px-5 py-6 sm:px-8">

        {/* ── info strip ──────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'From', value: transfer.fromWarehouse.name, icon: <Warehouse className="h-4 w-4" />, tone: 'cyan' },
            { label: 'To', value: isOutletBound ? `Outlet: ${transfer.toWarehouse.posOutlet?.name}` : transfer.toWarehouse.name, icon: <Package className="h-4 w-4" />, tone: isOutletBound ? 'emerald' : 'violet' },
            { label: 'Transfer value', value: money(totalValue), icon: <Boxes className="h-4 w-4" />, tone: 'amber' },
            { label: 'Created', value: dateLabel(new Date(transfer.createdAt)), icon: <Clock3 className="h-4 w-4" />, tone: 'slate' },
          ].map(k => (
            <div key={k.label} className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-4">
              <div className="flex items-start justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">{k.label}</p>
                <div className={`rounded-lg p-1.5 text-${k.tone === 'slate' ? 'slate-500' : `${k.tone}-300`} bg-${k.tone === 'slate' ? 'white/[0.04]' : `${k.tone}-400/10`}`}>{k.icon}</div>
              </div>
              <p className="mt-3 text-base font-semibold text-white">{k.value}</p>
            </div>
          ))}
        </div>

        {/* notes */}
        {transfer.notes && (
          <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] px-5 py-4 text-sm text-slate-400">
            <span className="font-semibold text-slate-300">Notes: </span>{transfer.notes}
          </div>
        )}

        {/* flow context */}
        {isOutletBound && (
          <div className="rounded-2xl border border-violet-400/15 bg-violet-400/[0.05] px-5 py-4">
            <p className="text-xs font-semibold text-violet-300 mb-2">Outlet transfer lifecycle</p>
            <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
              {[
                { label: 'Request', done: true },
                { label: 'Approved & Issued', done: ['APPROVED', 'ISSUED', 'COMPLETED'].includes(transfer.status) },
                { label: 'Received', done: ['COMPLETED'].includes(transfer.status) },
              ].map((step, i) => (
                <React.Fragment key={step.label}>
                  {i > 0 && <ArrowRight className="h-3 w-3 text-slate-600 shrink-0" />}
                  <span className={step.done ? 'text-emerald-300 font-semibold' : 'text-slate-500'}>{step.label}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {canReduceRequest && <TransferQuantityEditor transferId={transfer.id} items={transfer.items.map(item => ({ id: item.id, name: item.stockItem.name, quantity: Number(item.quantity), unit: item.unitOfMeasure }))} />}

        {/* line items */}
        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111c2e]">
          <div className="border-b border-white/[0.07] px-5 py-4">
            <p className="text-sm font-semibold text-white">Transfer items</p>
            <p className="mt-1 text-xs text-slate-500">{transfer.items.length} item{transfer.items.length !== 1 ? 's' : ''} · Total value {money(totalValue)}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-[10px] uppercase tracking-[0.14em] text-slate-600">
                  {['Item', 'Type', 'On hand', 'Transfer qty', 'Unit', 'Notes'].map(h => (
                    <th key={h} className="px-5 py-3 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.05]">
                {transfer.items.map(item => (
                  <tr key={item.id} className="hover:bg-white/[0.02]">
                    <td className="px-5 py-4 font-medium text-slate-200">{item.stockItem.name}</td>
                    <td className="px-5 py-4 text-xs capitalize text-slate-500">{(item.stockItem.stockType || 'CONSUMABLE').replace('_', ' ').toLowerCase()}</td>
                    <td className="px-5 py-4 text-slate-400">{Number(item.stockItem.quantityOnHand).toFixed(2)} {item.stockItem.baseUnit}</td>
                    <td className="px-5 py-4 font-semibold text-violet-300">{Number(item.quantity).toFixed(2)}</td>
                    <td className="px-5 py-4 text-slate-500">{item.unitOfMeasure}{item.stockItem.stockUnits[0] && <span className="block text-[11px] text-slate-600">1 {item.stockItem.stockUnits[0].unit} = {Number(item.stockItem.stockUnits[0].unitsInBase)} {item.stockItem.baseUnit}</span>}</td>
                    <td className="px-5 py-4 text-slate-500">{item.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* timestamps */}
        {(transfer.approvedAt || transfer.postedAt) && (
          <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-white/[0.08] bg-[#111c2e] px-5 py-4 text-xs text-slate-500">
            {transfer.approvedAt && <span><strong className="text-slate-300">Approved:</strong> {dateLabel(new Date(transfer.approvedAt))}</span>}
            {transfer.postedAt   && <span><strong className="text-slate-300">Issued:</strong> {dateLabel(new Date(transfer.postedAt))}</span>}
          </div>
        )}
      </main>
    </div>
  );
}
