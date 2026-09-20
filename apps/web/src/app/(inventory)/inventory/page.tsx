import React from 'react';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { formatUnit } from '@/lib/inventory/units';
import {
  AlertTriangle, ArrowDownToLine, ArrowRight, ArrowUpFromLine, BarChart3,
  Boxes, CalendarDays, CheckCircle2, ClipboardCheck, Clock3, FileText,
  Package, Plus, Receipt, ShoppingCart, Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const dynamic = 'force-dynamic';

const money = (value: number, currency = 'NGN') => new Intl.NumberFormat('en-NG', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(value);

const dateLabel = (value: Date) => value.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

export default async function InventoryDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const propertyId = (session.user as any).propertyId;
  if (!propertyId) redirect('/login');

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [stockItems, pendingPOs, pendingGRNs, pendingTransfers, pendingReconciliations, recentActivity] = await Promise.all([
    prisma.stockItem.findMany({
      where: { propertyId, isActive: true, warehouse: { posOutletId: null } },
      select: { id: true, name: true, quantityOnHand: true, reorderLevel: true, costPrice: true, stockType: true, baseUnit: true, warehouse: { select: { name: true } } },
    }),
    prisma.purchaseOrder.findMany({
      where: { propertyId, status: 'SUBMITTED' },
      select: { id: true, poNumber: true, expectedDate: true, status: true, totalAmount: true, currency: true, supplier: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.goodsReceivedNote.findMany({
      where: { propertyId, status: { in: ['DRAFT', 'SUBMITTED', 'APPROVED'] } },
      select: { id: true, grnNumber: true, status: true, receivedDate: true, purchaseOrder: { select: { poNumber: true } } },
      orderBy: { receivedDate: 'asc' },
    }),
    prisma.stockTransfer.findMany({
      where: { propertyId, status: 'PENDING_APPROVAL' },
      select: { id: true, transferRef: true, status: true, fromWarehouse: { select: { name: true } }, toWarehouse: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.approvalRequest.findMany({
      where: { propertyId, type: 'INVENTORY_ADJUSTMENT', status: 'PENDING' },
      select: { id: true, status: true, requestedAt: true },
      orderBy: { requestedAt: 'asc' },
    }),
    prisma.stockTransaction.findMany({
      where: { propertyId, timestamp: { gte: since }, warehouse: { posOutletId: null } },
      orderBy: { timestamp: 'desc' }, take: 200,
      include: { stockItem: { select: { name: true, baseUnit: true } } },
    }),
  ]);

  const lowStockItems: typeof stockItems = [];
  const outOfStockItems: typeof stockItems = [];
  let totalValue = 0;
  let itemsInStock = 0;
  for (const item of stockItems) {
    const quantity = Number(item.quantityOnHand);
    const reorder = item.reorderLevel === null ? null : Number(item.reorderLevel);
    totalValue += quantity * Number(item.costPrice);
    if (quantity > 0) itemsInStock += 1;
    if (quantity <= 0) outOfStockItems.push(item);
    else if (reorder !== null && quantity <= reorder) lowStockItems.push(item);
  }

  const warehouseStats = Object.values(stockItems.reduce<Record<string, { name: string; value: number; items: number; critical: number }>>((result, item) => {
    const name = item.warehouse.name;
    const row = result[name] || { name, value: 0, items: 0, critical: 0 };
    const quantity = Number(item.quantityOnHand);
    const reorder = item.reorderLevel === null ? null : Number(item.reorderLevel);
    row.value += quantity * Number(item.costPrice);
    row.items += 1;
    if (quantity <= 0 || (reorder !== null && quantity <= reorder)) row.critical += 1;
    result[name] = row;
    return result;
  }, {})).sort((a, b) => b.value - a.value);

  const receipts30d = recentActivity.filter((txn) => Number(txn.quantity) > 0).reduce((sum, txn) => sum + Number(txn.totalValue || 0), 0);
  const issues30d = recentActivity.filter((txn) => Number(txn.quantity) < 0).reduce((sum, txn) => sum + Math.abs(Number(txn.totalValue || 0)), 0);
  const pendingPOValue = pendingPOs.reduce((sum, po) => sum + Number(po.totalAmount || 0), 0);
  const attentionCount = outOfStockItems.length + lowStockItems.length + pendingPOs.length + pendingGRNs.length + pendingTransfers.length + pendingReconciliations.length;
  const dailyMovement = Array.from({ length: 14 }, (_, index) => {
    const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - (13 - index));
    const next = new Date(day); next.setDate(next.getDate() + 1);
    const dayRows = recentActivity.filter((txn) => txn.timestamp >= day && txn.timestamp < next);
    return {
      label: dateLabel(day),
      receipts: dayRows.filter((txn) => Number(txn.quantity) > 0).reduce((sum, txn) => sum + Math.abs(Number(txn.totalValue || 0)), 0),
      issues: dayRows.filter((txn) => Number(txn.quantity) < 0).reduce((sum, txn) => sum + Math.abs(Number(txn.totalValue || 0)), 0),
    };
  });
  const maxMovement = Math.max(...dailyMovement.map((day) => Math.max(day.receipts, day.issues)), 1);

  const actions: { label: string; href: string; icon: LucideIcon; tone: 'emerald' | 'cyan' | 'violet' }[] = [
    { label: 'New purchase order', href: '/inventory/purchase-orders/new', icon: Plus, tone: 'emerald' },
    { label: 'Receive goods', href: '/inventory/grns/new', icon: Truck, tone: 'cyan' },
    { label: 'Start stocktake', href: '/inventory/stocktakes/new', icon: ClipboardCheck, tone: 'violet' },
  ];

  const kpiCards: { label: string; value: string; sub: string; icon: LucideIcon; tone: 'emerald' | 'rose' | 'cyan' | 'violet' | 'amber' }[] = [
    { label: 'Inventory value', value: money(totalValue), sub: `${itemsInStock} lines with stock`, icon: Boxes, tone: 'emerald' },
    { label: 'Critical lines', value: String(outOfStockItems.length + lowStockItems.length), sub: `${outOfStockItems.length} out of stock`, icon: AlertTriangle, tone: 'rose' },
    { label: 'Open procurement', value: money(pendingPOValue), sub: `${pendingPOs.length} submitted POs`, icon: ShoppingCart, tone: 'cyan' },
    { label: 'Receipts · 30d', value: money(receipts30d), sub: `${recentActivity.filter((txn) => Number(txn.quantity) > 0).length} receipt movements`, icon: ArrowDownToLine, tone: 'violet' },
    { label: 'Issues · 30d', value: money(issues30d), sub: `${recentActivity.filter((txn) => Number(txn.quantity) < 0).length} usage movements`, icon: ArrowUpFromLine, tone: 'amber' },
  ];

  return (
    <div className="min-h-full bg-[#08111f] text-slate-100">
      <section className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_38%),linear-gradient(135deg,#0b1728,#08111f)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400"><Package className="h-4 w-4" /> Stock & procurement control room</div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Know what is on hand. Act before service feels it.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">A live view of inventory value, replenishment risk, receiving, transfers, and the controls protecting your property’s stock ledger.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {actions.map(({ label, href, icon: Icon, tone }) => (
                <Link key={href} href={href} className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${tone === 'emerald' ? 'border-emerald-400/30 bg-emerald-400/15 text-emerald-200 hover:bg-emerald-400/25' : tone === 'cyan' ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20' : 'border-violet-400/30 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20'}`}><Icon className="h-4 w-4" />{label}</Link>
              ))}
            </div>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400"><span className="inline-flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-emerald-400" />Live ledger window: last 30 days</span><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />{stockItems.length} active stock lines monitored</span><span className="inline-flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" />Updated from recorded transactions</span></div>
        </div>
      </section>

      <main className="mx-auto max-w-[1500px] space-y-6 px-5 py-6 sm:px-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {kpiCards.map(({ label, value, sub, icon: Icon, tone }) => (
            <div key={String(label)} className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5 shadow-2xl shadow-black/10">
              <div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p><div className={`rounded-xl p-2 ${tone === 'emerald' ? 'bg-emerald-400/10 text-emerald-300' : tone === 'rose' ? 'bg-rose-400/10 text-rose-300' : tone === 'cyan' ? 'bg-cyan-400/10 text-cyan-300' : tone === 'violet' ? 'bg-violet-400/10 text-violet-300' : 'bg-amber-400/10 text-amber-300'}`}><Icon className="h-4 w-4" /></div></div>
              <p className="mt-5 text-2xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_0.85fr]">
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111c2e]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><p className="text-sm font-semibold text-white">Replenishment queue</p><p className="mt-1 text-xs text-slate-500">Lines below reorder level and documents waiting for control</p></div><Link href="/inventory/alerts" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:text-emerald-200">Open alert register <ArrowRight className="h-3.5 w-3.5" /></Link></div>
            <div className="divide-y divide-white/[0.06]">
              {[...outOfStockItems.map((item) => ({ type: 'OUT', item })), ...lowStockItems.map((item) => ({ type: 'LOW', item }))].slice(0, 5).map(({ type, item }) => (
                <div key={item.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.025]"><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-200">{item.name}</p><p className={`mt-1 text-xs ${type === 'OUT' ? 'text-rose-300' : 'text-amber-300'}`}>{type === 'OUT' ? 'Out of stock' : `At / below reorder level · ${Number(item.quantityOnHand)} ${formatUnit(item.baseUnit)}`} · {item.warehouse.name}</p></div><Link href={`/inventory/stock-items/${item.id}`} className="shrink-0 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-white/5">Inspect</Link></div>
              ))}
              {outOfStockItems.length + lowStockItems.length === 0 && <div className="flex items-center gap-3 px-5 py-8 text-sm text-emerald-300"><CheckCircle2 className="h-5 w-5" />All active stock lines are above their configured reorder levels.</div>}
              {pendingPOs.slice(0, 2).map((po) => <div key={po.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.025]"><div><p className="text-sm font-semibold text-slate-200">{po.poNumber} · {po.supplier.name}</p><p className="mt-1 text-xs text-cyan-300">Submitted for approval · {money(Number(po.totalAmount), po.currency)}</p></div><Link href={`/inventory/purchase-orders/${po.id}`} className="shrink-0 rounded-lg border border-cyan-400/20 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-400/10">Review</Link></div>)}
            </div>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Control workload</p><p className="mt-1 text-xs text-slate-500">Items requiring a recorded decision</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${attentionCount ? 'bg-amber-400/10 text-amber-300' : 'bg-emerald-400/10 text-emerald-300'}`}>{attentionCount} open</span></div><div className="mt-5 space-y-3">{[{ label: 'Submitted purchase orders', count: pendingPOs.length, href: '/inventory/purchase-orders', icon: ShoppingCart }, { label: 'Receiving documents', count: pendingGRNs.length, href: '/inventory/grns', icon: Receipt }, { label: 'Transfers awaiting approval', count: pendingTransfers.length, href: '/inventory/transfers', icon: Truck }, { label: 'Stock adjustments', count: pendingReconciliations.length, href: '/inventory/reconciliation', icon: ClipboardCheck }].map(({ label, count, href, icon: Icon }) => <Link href={href} key={href} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 hover:bg-white/[0.05]"><span className="flex items-center gap-3 text-sm text-slate-300"><Icon className="h-4 w-4 text-slate-500" />{label}</span><span className={`text-sm font-bold ${count ? 'text-amber-300' : 'text-slate-500'}`}>{count}</span></Link>)}</div></section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Stock movement value</p><p className="mt-1 text-xs text-slate-500">Recorded receipts and issues · 14-day view</p></div><BarChart3 className="h-4 w-4 text-slate-500" /></div><div className="mt-6 flex h-40 items-end gap-2">{dailyMovement.map((day) => <div key={day.label} className="group flex min-w-0 flex-1 flex-col items-center gap-2"><div className="flex h-32 w-full items-end justify-center gap-1"><div title={`${day.label} receipts: ${money(day.receipts)}`} className="w-1/2 rounded-t bg-emerald-400/80 transition group-hover:bg-emerald-300" style={{ height: `${Math.max(day.receipts / maxMovement * 100, day.receipts ? 4 : 0)}%` }} /><div title={`${day.label} issues: ${money(day.issues)}`} className="w-1/2 rounded-t bg-rose-400/70 transition group-hover:bg-rose-300" style={{ height: `${Math.max(day.issues / maxMovement * 100, day.issues ? 4 : 0)}%` }} /></div><span className="truncate text-[10px] text-slate-600">{day.label}</span></div>)}</div><div className="mt-4 flex gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-emerald-400" />Receipts</span><span className="inline-flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-rose-400" />Issues / usage</span></div></section>

          <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Warehouse exposure</p><p className="mt-1 text-xs text-slate-500">On-hand value by main warehouse</p></div><Link href="/inventory/warehouses" className="text-xs font-semibold text-emerald-300">View all</Link></div><div className="mt-5 space-y-4">{warehouseStats.slice(0, 4).map((warehouse) => <div key={warehouse.name}><div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-sm text-slate-300">{warehouse.name}</span><span className="text-sm font-semibold text-white">{money(warehouse.value)}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${Math.max(warehouse.value / Math.max(totalValue, 1) * 100, warehouse.value ? 2 : 0)}%` }} /></div><p className="mt-1 text-[11px] text-slate-600">{warehouse.items} lines · {warehouse.critical} critical</p></div>)}{warehouseStats.length === 0 && <p className="py-6 text-sm text-slate-500">No main-warehouse stock recorded.</p>}</div></section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e]"><div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><p className="text-sm font-semibold text-white">Recent ledger activity</p><p className="mt-1 text-xs text-slate-500">Latest quantity movements recorded in inventory</p></div><Link href="/inventory/stock-items" className="text-xs font-semibold text-emerald-300">Stock register</Link></div><div className="divide-y divide-white/[0.06]">{recentActivity.slice(0, 6).map((txn) => { const incoming = Number(txn.quantity) > 0; return <div key={txn.id} className="flex items-center gap-3 px-5 py-3"><div className={`rounded-lg p-2 ${incoming ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>{incoming ? <ArrowDownToLine className="h-3.5 w-3.5" /> : <ArrowUpFromLine className="h-3.5 w-3.5" />}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-slate-300">{txn.stockItem.name}</p><p className="text-xs capitalize text-slate-600">{txn.source.toLowerCase().replace(/_/g, ' ')} · {dateLabel(txn.timestamp)}</p></div><span className={`text-xs font-bold ${incoming ? 'text-emerald-300' : 'text-rose-300'}`}>{incoming ? '+' : ''}{Number(txn.quantity)} {formatUnit(txn.stockItem.baseUnit)}</span></div> })}{recentActivity.length === 0 && <p className="px-5 py-8 text-center text-sm text-slate-500">No inventory movements in the last 30 days.</p>}</div></section>
          <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300"><FileText className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-white">Operating rhythm</p><p className="mt-1 text-xs text-slate-500">The controls that keep procurement and stock reliable</p></div></div><div className="mt-5 grid gap-3 sm:grid-cols-2">{[{ title: 'Reorder discipline', body: 'Keep min/max or reorder levels current for every active line.', href: '/inventory/stock-items', icon: Boxes }, { title: 'Receiving integrity', body: 'Match deliveries to approved purchase orders before posting.', href: '/inventory/grns', icon: Truck }, { title: 'Count confidence', body: 'Run controlled stocktakes and route variances for approval.', href: '/inventory/stocktakes', icon: ClipboardCheck }, { title: 'Cost visibility', body: 'Review valuation, recipe cost, waste, and usage together.', href: '/inventory/cost-control', icon: BarChart3 }].map(({ title, body, href, icon: Icon }) => <Link href={href} key={href} className="rounded-xl border border-white/[0.07] p-4 hover:border-emerald-400/30 hover:bg-white/[0.025]"><Icon className="h-4 w-4 text-emerald-300" /><p className="mt-3 text-sm font-semibold text-slate-200">{title}</p><p className="mt-1 text-xs leading-5 text-slate-500">{body}</p><span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">Open workflow <ArrowRight className="h-3 w-3" /></span></Link>)}</div></section>
        </div>
      </main>
    </div>
  );
}
