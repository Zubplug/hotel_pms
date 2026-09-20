import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle, ArrowLeftRight, ArrowRight, Boxes, CheckCircle2,
  ClipboardCheck, MapPin, Package, Plus, Truck, Warehouse as WarehouseIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import WarehouseClientActions from './WarehouseClientActions';
import EditWarehouseDialog from './EditWarehouseDialog';

export const dynamic = 'force-dynamic';

const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

export default async function WarehousesPage() {
  const session = await auth();
  if (!session?.user?.propertyId) redirect('/login');
  const propertyId = session.user.propertyId;

  const [warehouses, pendingTransfers, recentTransactions] = await Promise.all([
    prisma.warehouse.findMany({
      where: { propertyId, posOutletId: null, isActive: true },
      include: {
        stockItems: { where: { isActive: true }, select: { id: true, name: true, quantityOnHand: true, reorderLevel: true, costPrice: true } },
        _count: { select: { stockItems: true, transfersFrom: true, transfersTo: true, stocktakes: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.stockTransfer.findMany({
      where: { propertyId, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'ISSUED'] } },
      select: { id: true, transferRef: true, status: true, createdAt: true, fromWarehouse: { select: { name: true } }, toWarehouse: { select: { name: true } } },
      orderBy: { createdAt: 'desc' }, take: 8,
    }),
    prisma.stockTransaction.findMany({
      where: { propertyId, timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, warehouse: { posOutletId: null } },
      select: { warehouseId: true, quantity: true, totalValue: true }, take: 1000,
    }),
  ]);

  const warehouseRows = warehouses.map((warehouse) => {
    const itemCount = warehouse.stockItems.length;
    const value = warehouse.stockItems.reduce((sum, item) => sum + Number(item.quantityOnHand) * Number(item.costPrice), 0);
    const critical = warehouse.stockItems.filter((item) => Number(item.quantityOnHand) <= 0 || (item.reorderLevel !== null && Number(item.quantityOnHand) <= Number(item.reorderLevel))).length;
    const movements = recentTransactions.filter((transaction) => transaction.warehouseId === warehouse.id);
    const receipts = movements.filter((transaction) => Number(transaction.quantity) > 0).reduce((sum, transaction) => sum + Math.abs(Number(transaction.totalValue || 0)), 0);
    const issues = movements.filter((transaction) => Number(transaction.quantity) < 0).reduce((sum, transaction) => sum + Math.abs(Number(transaction.totalValue || 0)), 0);
    return { warehouse, itemCount, value, critical, receipts, issues, movementCount: movements.length };
  });
  const totalValue = warehouseRows.reduce((sum, row) => sum + row.value, 0);
  const totalItems = warehouseRows.reduce((sum, row) => sum + row.itemCount, 0);
  const totalCritical = warehouseRows.reduce((sum, row) => sum + row.critical, 0);
  const totalReceipts = warehouseRows.reduce((sum, row) => sum + row.receipts, 0);
  const totalIssues = warehouseRows.reduce((sum, row) => sum + row.issues, 0);
  const maxValue = Math.max(...warehouseRows.map((row) => row.value), 1);
  const kpiCards: { label: string; value: string; sub: string; icon: LucideIcon; tone: 'emerald' | 'cyan' | 'rose' | 'violet' | 'amber' }[] = [
    { label: 'On-hand value', value: money(totalValue), sub: 'Across active warehouses', icon: Package, tone: 'emerald' },
    { label: 'Warehouse lines', value: String(totalItems), sub: `${warehouses.length} storage locations`, icon: Boxes, tone: 'cyan' },
    { label: 'Critical exposure', value: String(totalCritical), sub: 'Lines at or below reorder', icon: AlertTriangle, tone: 'rose' },
    { label: 'Receipts · 30d', value: money(totalReceipts), sub: 'Incoming stock value', icon: Truck, tone: 'violet' },
    { label: 'Issues · 30d', value: money(totalIssues), sub: 'Outgoing stock value', icon: ArrowLeftRight, tone: 'amber' },
  ];

  return (
    <div className="min-h-full bg-[#08111f] text-slate-100">
      <section className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.14),_transparent_36%),linear-gradient(135deg,#0b1728,#08111f)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div><div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300"><WarehouseIcon className="h-4 w-4" /> Warehouse control</div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Storage network</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">See where stock value sits, which stores need intervention, and how inventory is moving across the property.</p></div>
            <div className="flex flex-wrap gap-2"><WarehouseClientActions /><Link href="/inventory/transfers/new" className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/20"><ArrowLeftRight className="h-4 w-4" /> New transfer</Link><Link href="/inventory/stocktakes/new" className="inline-flex items-center gap-2 rounded-xl border border-violet-400/30 bg-violet-400/10 px-4 py-2.5 text-sm font-semibold text-violet-200 hover:bg-violet-400/20"><ClipboardCheck className="h-4 w-4" /> Start stocktake</Link></div>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />{warehouses.length} active main warehouses</span><span>{totalItems} active stock lines held</span><span>Movement window: last 30 days</span></div>
        </div>
      </section>

      <main className="mx-auto max-w-[1500px] space-y-6 px-5 py-6 sm:px-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{kpiCards.map(({ label, value, sub, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p><div className={`rounded-xl p-2 ${tone === 'emerald' ? 'bg-emerald-400/10 text-emerald-300' : tone === 'cyan' ? 'bg-cyan-400/10 text-cyan-300' : tone === 'rose' ? 'bg-rose-400/10 text-rose-300' : tone === 'violet' ? 'bg-violet-400/10 text-violet-300' : 'bg-amber-400/10 text-amber-300'}`}><Icon className="h-4 w-4" /></div></div><p className="mt-5 text-2xl font-semibold text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{sub}</p></div>)}</div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Warehouse exposure</p><p className="mt-1 text-xs text-slate-500">Current value, stock-line coverage, and critical pressure by store</p></div><Link href="/inventory/stock-items" className="text-xs font-semibold text-cyan-300">Open stock register</Link></div><div className="mt-6 space-y-5">{warehouseRows.map(({ warehouse, itemCount, value, critical, movementCount }) => <div key={warehouse.id}><div className="flex items-center justify-between gap-4"><div className="min-w-0"><Link href={`/inventory/stock-items?warehouse=${warehouse.id}`} className="truncate text-sm font-semibold text-slate-200 hover:text-cyan-200">{warehouse.name}</Link><p className="mt-1 flex items-center gap-1 text-xs text-slate-600"><MapPin className="h-3 w-3" />{warehouse.location || 'Location not configured'} · {itemCount} active lines</p></div><div className="text-right"><p className="text-sm font-semibold text-white">{money(value)}</p><p className="mt-1 text-[11px] text-slate-600">{movementCount} movements</p></div></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${Math.max(value / maxValue * 100, value ? 2 : 0)}%` }} /></div><p className={`mt-1 text-[11px] ${critical ? 'text-amber-300' : 'text-slate-600'}`}>{critical ? `${critical} lines require replenishment attention` : 'No current reorder exceptions'}</p></div>)}{warehouseRows.length === 0 && <p className="py-10 text-center text-sm text-slate-500">No active main warehouses configured.</p>}</div></section>
          <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div><p className="text-sm font-semibold text-white">Warehouse controls</p><p className="mt-1 text-xs text-slate-500">Move, count, and protect stock custody</p></div><div className="mt-5 space-y-3">{[{ label: 'Transfers awaiting control', value: pendingTransfers.filter((t) => t.status === 'PENDING_APPROVAL').length, href: '/inventory/transfers', icon: ArrowLeftRight }, { label: 'Stocktake workspace', value: warehouseRows.reduce((sum, row) => sum + row.warehouse._count.stocktakes, 0), href: '/inventory/stocktakes', icon: ClipboardCheck }, { label: 'Warehouse items', value: totalItems, href: '/inventory/stock-items', icon: Boxes }].map(({ label, value, href, icon: Icon }) => <Link href={href} key={href} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3 hover:bg-white/[0.05]"><span className="flex items-center gap-3 text-sm text-slate-300"><Icon className="h-4 w-4 text-slate-500" />{label}</span><span className="text-sm font-bold text-cyan-300">{value}</span></Link>)}</div><div className="mt-5 rounded-xl border border-amber-400/10 bg-amber-400/[0.04] p-4"><p className="text-xs font-semibold text-amber-200">Control principle</p><p className="mt-1 text-xs leading-5 text-slate-500">Transfers should be approved and recorded so source and receiving locations remain aligned in the stock ledger.</p></div></section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111c2e]"><div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4"><div><p className="text-sm font-semibold text-white">Transfer activity</p><p className="mt-1 text-xs text-slate-500">Latest movement requests between storage locations</p></div><Link href="/inventory/transfers" className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-300">View register <ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="divide-y divide-white/[0.06]">{pendingTransfers.slice(0, 6).map((transfer) => <Link href={`/inventory/transfers/${transfer.id}`} key={transfer.id} className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-white/[0.025]"><div className="min-w-0"><p className="font-mono text-xs font-bold text-slate-300">{transfer.transferRef}</p><p className="mt-1 truncate text-xs text-slate-500">{transfer.fromWarehouse.name} <ArrowRight className="mx-1 inline h-3 w-3" /> {transfer.toWarehouse.name}</p></div><span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${transfer.status === 'PENDING_APPROVAL' ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : transfer.status === 'ISSUED' ? 'border-cyan-400/20 bg-cyan-400/10 text-cyan-300' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'}`}>{transfer.status.replace(/_/g, ' ')}</span></Link>)}{pendingTransfers.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">No active transfers requiring attention.</p>}</div></section>
          <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div className="flex items-center gap-3"><div className="rounded-xl bg-cyan-400/10 p-2 text-cyan-300"><WarehouseIcon className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-white">Location readiness</p><p className="mt-1 text-xs text-slate-500">Configuration signals for reliable warehouse operations</p></div></div><div className="mt-5 space-y-3">{[{ label: 'Named locations', count: warehouseRows.filter((row) => row.warehouse.location).length, total: warehouses.length }, { label: 'Warehouses with stock', count: warehouseRows.filter((row) => row.itemCount > 0).length, total: warehouses.length }, { label: 'Warehouses with movement', count: warehouseRows.filter((row) => row.movementCount > 0).length, total: warehouses.length }].map((row) => <div key={row.label} className="flex items-center justify-between rounded-xl border border-white/[0.06] px-3 py-3"><span className="text-sm text-slate-300">{row.label}</span><span className={`text-sm font-bold ${row.count === row.total ? 'text-emerald-300' : 'text-amber-300'}`}>{row.count}/{row.total}</span></div>)}</div></section>
        </div>

        <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Warehouse directory</p><p className="mt-1 text-xs text-slate-500">Open a warehouse’s stock slice or maintain its master data.</p></div><span className="text-xs text-slate-600">{warehouses.length} active</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{warehouseRows.map(({ warehouse, itemCount, value, critical }) => <div key={warehouse.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><div className="rounded-xl bg-emerald-400/10 p-2 text-emerald-300"><WarehouseIcon className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-200">{warehouse.name}</p><p className="truncate text-xs text-slate-600">{warehouse.location || 'Location not configured'}</p></div></div><EditWarehouseDialog warehouse={{ id: warehouse.id, name: warehouse.name, location: warehouse.location }} /></div><div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-white/[0.03] p-2"><p className="text-slate-600">Value</p><p className="mt-1 font-semibold text-white">{money(value)}</p></div><div className="rounded-lg bg-white/[0.03] p-2"><p className="text-slate-600">Critical</p><p className={`mt-1 font-semibold ${critical ? 'text-amber-300' : 'text-emerald-300'}`}>{critical}</p></div></div><Link href={`/inventory/stock-items?warehouse=${warehouse.id}`} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300">View warehouse stock <ArrowRight className="h-3.5 w-3.5" /></Link></div>)}</div></section>
      </main>
    </div>
  );
}
