import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  AlertTriangle, ArrowDownToLine, ArrowRight, ArrowUpFromLine, BarChart3,
  Boxes, CheckCircle2, Edit, Eye, Filter, Package, Plus, Search, SlidersHorizontal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatUnit } from '@/lib/inventory/units';

const STOCK_TYPE_FILTERS = [
  { value: '', label: 'All types' },
  { value: 'SELLABLE', label: 'Sellable' },
  { value: 'RAW_MATERIAL', label: 'Raw materials' },
  { value: 'CONSUMABLE', label: 'Consumables' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'ASSET', label: 'Assets' },
  { value: 'PACKAGING', label: 'Packaging' },
] as const;

const stockTypeLabel = (value: string) => STOCK_TYPE_FILTERS.find((type) => type.value === value)?.label || value.replace(/_/g, ' ');
const money = (value: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value);

function status(qty: number, reorder: number | null) {
  if (qty <= 0) return { label: 'Out of stock', tone: 'rose' as const };
  if (reorder !== null && qty <= reorder) return { label: 'Below reorder', tone: 'amber' as const };
  return { label: 'Healthy', tone: 'emerald' as const };
}

export default async function StockItemsPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const session = await auth();
  if (!session?.user?.propertyId) redirect('/login');
  const params = await searchParams;
  const selectedType = STOCK_TYPE_FILTERS.some((type) => type.value === params.type) ? params.type || '' : '';
  const propertyId = session.user.propertyId;

  const [stockItems, recentTransactions] = await Promise.all([
    prisma.stockItem.findMany({
      where: { propertyId, isActive: true, warehouse: { posOutletId: null }, ...(selectedType ? { stockType: selectedType as any } : {}) },
      include: { warehouse: { select: { name: true } }, inventoryCategory: { select: { name: true } }, posProduct: { select: { category: { select: { name: true } } } } },
      orderBy: { name: 'asc' },
    }),
    prisma.stockTransaction.findMany({
      where: { propertyId, timestamp: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, warehouse: { posOutletId: null } },
      select: { stockItemId: true, quantity: true, totalValue: true, source: true, timestamp: true },
      orderBy: { timestamp: 'desc' }, take: 500,
    }),
  ]);

  const movementByItem = new Map<string, { count: number; receipts: number; issues: number; lastSource: string | null; lastAt: Date | null }>();
  for (const transaction of recentTransactions) {
    const row = movementByItem.get(transaction.stockItemId) || { count: 0, receipts: 0, issues: 0, lastSource: null, lastAt: null };
    const value = Math.abs(Number(transaction.totalValue || 0));
    row.count += 1;
    if (Number(transaction.quantity) >= 0) row.receipts += value;
    else row.issues += value;
    if (!row.lastAt) { row.lastAt = transaction.timestamp; row.lastSource = transaction.source; }
    movementByItem.set(transaction.stockItemId, row);
  }

  const totals = stockItems.reduce((result, item) => {
    const quantity = Number(item.quantityOnHand);
    const reorder = item.reorderLevel === null ? null : Number(item.reorderLevel);
    result.value += quantity * Number(item.costPrice);
    result.items += 1;
    if (quantity <= 0) result.out += 1;
    else if (reorder !== null && quantity <= reorder) result.low += 1;
    if (reorder !== null) result.configured += 1;
    return result;
  }, { value: 0, items: 0, out: 0, low: 0, configured: 0 });
  const receipts30d = recentTransactions.filter((transaction) => Number(transaction.quantity) > 0).reduce((sum, transaction) => sum + Math.abs(Number(transaction.totalValue || 0)), 0);
  const issues30d = recentTransactions.filter((transaction) => Number(transaction.quantity) < 0).reduce((sum, transaction) => sum + Math.abs(Number(transaction.totalValue || 0)), 0);
  const categoryStats = Object.values(stockItems.reduce<Record<string, { name: string; count: number; value: number; critical: number }>>((result, item) => {
    const name = item.inventoryCategory?.name || item.posProduct?.category?.name || 'Uncategorized';
    const row = result[name] || { name, count: 0, value: 0, critical: 0 };
    const itemStatus = status(Number(item.quantityOnHand), item.reorderLevel === null ? null : Number(item.reorderLevel));
    row.count += 1; row.value += Number(item.quantityOnHand) * Number(item.costPrice); if (itemStatus.tone !== 'emerald') row.critical += 1;
    result[name] = row; return result;
  }, {})).sort((a, b) => b.value - a.value);
  const warehouseStats = Object.values(stockItems.reduce<Record<string, { name: string; count: number; value: number }>>((result, item) => {
    const name = item.warehouse?.name || 'Unassigned'; const row = result[name] || { name, count: 0, value: 0 };
    row.count += 1; row.value += Number(item.quantityOnHand) * Number(item.costPrice); result[name] = row; return result;
  }, {})).sort((a, b) => b.value - a.value);
  const maxCategoryValue = Math.max(...categoryStats.map((row) => row.value), 1);
  const kpiCards: { label: string; value: string; sub: string; icon: LucideIcon; tone: 'emerald' | 'cyan' | 'rose' | 'violet' | 'amber' }[] = [
    { label: 'On-hand value', value: money(totals.value), sub: 'Active main-warehouse items', icon: Package, tone: 'emerald' },
    { label: 'Active item lines', value: String(totals.items), sub: `${totals.configured} with reorder level`, icon: Boxes, tone: 'cyan' },
    { label: 'Replenishment risk', value: String(totals.out + totals.low), sub: `${totals.out} out · ${totals.low} below reorder`, icon: AlertTriangle, tone: 'rose' },
    { label: 'Receipts · 30d', value: money(receipts30d), sub: 'Recorded incoming value', icon: ArrowDownToLine, tone: 'violet' },
    { label: 'Issues · 30d', value: money(issues30d), sub: 'Recorded usage value', icon: ArrowUpFromLine, tone: 'amber' },
  ];

  return (
    <div className="min-h-full bg-[#08111f] text-slate-100">
      <section className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_right,_rgba(34,211,238,0.13),_transparent_35%),linear-gradient(135deg,#0b1728,#08111f)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div><div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-cyan-300"><Boxes className="h-4 w-4" /> Item master & stock control</div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Stock register</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">A live item-level view of on-hand quantity, valuation, reorder discipline, warehouse exposure, and movement signals.</p></div>
            <div className="flex flex-wrap gap-2"><Link href="/inventory/stock-items/new" className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/15 px-4 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/25"><Plus className="h-4 w-4" /> New stock item</Link><Link href="/inventory/reconciliation" className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[0.08]"><SlidersHorizontal className="h-4 w-4" /> Adjustments</Link></div>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500"><span className="inline-flex items-center gap-2"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />{totals.items} active item lines</span><span className="inline-flex items-center gap-2"><BarChart3 className="h-3.5 w-3.5 text-cyan-300" />{recentTransactions.length} movements in the last 30 days</span><span>{totals.configured} items have reorder levels configured</span></div>
        </div>
      </section>

      <main className="mx-auto max-w-[1500px] space-y-6 px-5 py-6 sm:px-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">{kpiCards.map(({ label, value, sub, icon: Icon, tone }) => <div key={label} className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5 shadow-2xl shadow-black/10"><div className="flex items-start justify-between"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p><div className={`rounded-xl p-2 ${tone === 'emerald' ? 'bg-emerald-400/10 text-emerald-300' : tone === 'cyan' ? 'bg-cyan-400/10 text-cyan-300' : tone === 'rose' ? 'bg-rose-400/10 text-rose-300' : tone === 'violet' ? 'bg-violet-400/10 text-violet-300' : 'bg-amber-400/10 text-amber-300'}`}><Icon className="h-4 w-4" /></div></div><p className="mt-5 text-2xl font-semibold tracking-tight text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{sub}</p></div>)}</div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Catalogue intelligence</p><p className="mt-1 text-xs text-slate-500">Value and control exposure by inventory category</p></div><Link href="/inventory/alerts" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">Open alerts <ArrowRight className="h-3.5 w-3.5" /></Link></div><div className="mt-6 space-y-4">{categoryStats.slice(0, 6).map((row) => <div key={row.name}><div className="mb-2 flex items-center justify-between gap-3"><span className="truncate text-sm text-slate-300">{row.name}</span><span className="text-xs text-slate-500">{row.count} lines · <strong className="text-slate-200">{money(row.value)}</strong></span></div><div className="h-2 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400" style={{ width: `${Math.max(row.value / maxCategoryValue * 100, row.value ? 2 : 0)}%` }} /></div><p className={`mt-1 text-[11px] ${row.critical ? 'text-amber-300' : 'text-slate-600'}`}>{row.critical ? `${row.critical} lines require replenishment attention` : 'No current reorder exceptions'}</p></div>)}{categoryStats.length === 0 && <p className="py-6 text-sm text-slate-500">No active stock items match this view.</p>}</div></section>
          <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Warehouse distribution</p><p className="mt-1 text-xs text-slate-500">Where active item value is held</p></div><Link href="/inventory/warehouses" className="text-xs font-semibold text-cyan-300">View warehouses</Link></div><div className="mt-5 space-y-3">{warehouseStats.slice(0, 5).map((row) => <div key={row.name} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-300">{row.name}</p><p className="text-xs text-slate-600">{row.count} active lines</p></div><span className="text-sm font-semibold text-white">{money(row.value)}</span></div>)}{warehouseStats.length === 0 && <p className="py-6 text-sm text-slate-500">No warehouse data available.</p>}</div></section>
        </div>

        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111c2e]
        "><div className="border-b border-white/[0.07] px-5 py-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><p className="text-sm font-semibold text-white">Item register</p><p className="mt-1 text-xs text-slate-500">Inspect item master data, current balance, reorder control, and recent movement.</p></div><div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-slate-500"><Search className="h-3.5 w-3.5" />Use the type filters below to narrow the register</div></div><div className="mt-5 flex flex-wrap gap-2">{STOCK_TYPE_FILTERS.map((type) => <Link key={type.value || 'all'} href={type.value ? `/inventory/stock-items?type=${type.value}` : '/inventory/stock-items'} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${selectedType === type.value ? 'border-cyan-400/30 bg-cyan-400/15 text-cyan-200' : 'border-white/[0.07] bg-white/[0.02] text-slate-500 hover:bg-white/[0.06] hover:text-slate-300'}`}><Filter className="mr-1 inline h-3 w-3" />{type.label}</Link>)}</div></div>
          {stockItems.length === 0 ? <div className="flex flex-col items-center justify-center px-6 py-20 text-center"><div className="rounded-2xl bg-cyan-400/10 p-4 text-cyan-300"><Boxes className="h-8 w-8" /></div><p className="mt-4 text-sm font-semibold text-slate-300">No stock items in this view</p><p className="mt-1 text-sm text-slate-500">Create an item or change the type filter to continue.</p></div> : <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-sm"><thead><tr className="border-b border-white/[0.07] text-left text-[10px] uppercase tracking-[0.14em] text-slate-600">{['Item / identifier', 'Warehouse', 'Classification', 'On hand', 'Reorder', 'Value', '30d movement', 'Status', ''].map((heading) => <th key={heading} className={`px-5 py-3 font-semibold ${['On hand', 'Reorder', 'Value', '30d movement', 'Status', ''].includes(heading) ? 'text-right' : ''}`}>{heading}</th>)}</tr></thead><tbody className="divide-y divide-white/[0.06]">{stockItems.map((item) => { const itemStatus = status(Number(item.quantityOnHand), item.reorderLevel === null ? null : Number(item.reorderLevel)); const movement = movementByItem.get(item.id); const category = item.inventoryCategory?.name || item.posProduct?.category?.name || 'Uncategorized'; return <tr key={item.id} className="group hover:bg-white/[0.025]"><td className="px-5 py-4"><Link href={`/inventory/stock-items/${item.id}`} className="font-semibold text-slate-200 hover:text-cyan-200">{item.name}</Link><p className="mt-1 font-mono text-[11px] text-slate-600">{item.sku || item.barcode || 'No SKU / barcode'}</p></td><td className="px-5 py-4 text-slate-400">{item.warehouse?.name || 'Unassigned'}</td><td className="px-5 py-4"><span className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-xs text-slate-400">{category}</span><p className="mt-2 text-[11px] capitalize text-slate-600">{stockTypeLabel(item.stockType)}</p></td><td className="px-5 py-4 text-right"><span className="font-semibold text-white">{Number(item.quantityOnHand).toLocaleString()}</span><span className="ml-1 text-xs text-slate-600">{formatUnit(item.baseUnit)}</span></td><td className="px-5 py-4 text-right text-slate-400">{item.reorderLevel === null ? <span className="text-slate-600">Not set</span> : `${Number(item.reorderLevel).toLocaleString()} ${formatUnit(item.baseUnit)}`}</td><td className="px-5 py-4 text-right font-semibold text-slate-200">{money(Number(item.quantityOnHand) * Number(item.costPrice))}</td><td className="px-5 py-4 text-right"><span className="text-xs text-slate-400">{movement?.count || 0} movements</span><p className="mt-1 text-[11px] text-slate-600">{movement?.lastSource ? movement.lastSource.toLowerCase().replace(/_/g, ' ') : 'No movement'}</p></td><td className="px-5 py-4 text-right"><span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${itemStatus.tone === 'rose' ? 'border-rose-400/20 bg-rose-400/10 text-rose-300' : itemStatus.tone === 'amber' ? 'border-amber-400/20 bg-amber-400/10 text-amber-300' : 'border-emerald-400/20 bg-emerald-400/10 text-emerald-300'}`}><i className={`h-1.5 w-1.5 rounded-full ${itemStatus.tone === 'rose' ? 'bg-rose-400' : itemStatus.tone === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'}`} />{itemStatus.label}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100"><Link aria-label={`Edit ${item.name}`} href={`/inventory/stock-items/${item.id}/edit`} className="rounded-lg p-2 text-slate-500 hover:bg-white/[0.06] hover:text-white"><Edit className="h-3.5 w-3.5" /></Link><Link aria-label={`View ${item.name}`} href={`/inventory/stock-items/${item.id}`} className="rounded-lg p-2 text-slate-500 hover:bg-cyan-400/10 hover:text-cyan-200"><Eye className="h-3.5 w-3.5" /></Link></div></td></tr>; })}</tbody></table></div>}
        </section>
      </main>
    </div>
  );
}
