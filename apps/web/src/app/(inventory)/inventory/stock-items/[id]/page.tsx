import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatUnit } from '@/lib/inventory/units';
import {
  Package, ArrowLeft, Tag, BarChart2, Building2, Edit3,
  Hash, Scan, FolderOpen, AlertTriangle, CheckCircle2,
  TrendingUp, TrendingDown, Minus, ClipboardList, Scale,
  ShieldAlert, Clock,
} from 'lucide-react';

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const money = (v: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(v);

const txSourceColour: Record<string, string> = {
  GRN:              'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
  OPENING_BALANCE:  'bg-cyan-400/10    text-cyan-300    border-cyan-400/20',
  POS_SALE:         'bg-rose-400/10    text-rose-300    border-rose-400/20',
  RECIPE_DEPLETION: 'bg-orange-400/10  text-orange-300  border-orange-400/20',
  ADJUSTMENT:       'bg-amber-400/10   text-amber-300   border-amber-400/20',
  TRANSFER_IN:      'bg-violet-400/10  text-violet-300  border-violet-400/20',
  TRANSFER_OUT:     'bg-pink-400/10    text-pink-300    border-pink-400/20',
  STOCKTAKE:        'bg-sky-400/10     text-sky-300     border-sky-400/20',
  WASTE:            'bg-red-400/10     text-red-300     border-red-400/20',
};

function txBadge(source: string) {
  return txSourceColour[source] ?? 'bg-slate-400/10 text-slate-300 border-slate-400/20';
}

/* ─── page ─────────────────────────────────────────────────────────────────── */
export default async function StockItemDetailPage(props: { params: Promise<{ id: string }> }) {
  const params  = await props.params;
  const session = await auth();
  if (!session?.user?.propertyId) return null;

  const item = await prisma.stockItem.findUnique({
    where: { id: params.id, propertyId: session.user.propertyId },
    include: {
      warehouse:         true,
      inventoryCategory: true,
      stockUnits:        { orderBy: { unit: 'asc' } },
    },
  });

  if (!item) notFound();

  const transactions = await prisma.stockTransaction.findMany({
    where: { stockItemId: item.id },
    orderBy: { timestamp: 'desc' },
    take: 50,
  });

  /* derived */
  const qty          = Number(item.quantityOnHand);
  const cost         = Number(item.costPrice);
  const totalValue   = qty * cost;
  const reorder      = item.reorderLevel ? Number(item.reorderLevel) : null;
  const isLow        = reorder !== null && qty <= reorder;
  const isOut        = qty <= 0;
  const stockPct     = reorder && reorder > 0 ? Math.min(100, Math.round((qty / (reorder * 2)) * 100)) : null;

  const statusLabel  = isOut ? 'Out of Stock' : isLow ? 'Low Stock'  : 'In Stock';
  const statusColour = isOut
    ? 'text-rose-300 bg-rose-400/10 border-rose-400/25'
    : isLow
    ? 'text-amber-300 bg-amber-400/10 border-amber-400/25'
    : 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25';
  const StatusIcon   = isOut ? ShieldAlert : isLow ? AlertTriangle : CheckCircle2;

  /* tx stats */
  const inflow  = transactions.filter(t => Number(t.quantity) > 0).reduce((s, t) => s + Number(t.quantity), 0);
  const outflow = transactions.filter(t => Number(t.quantity) < 0).reduce((s, t) => s + Math.abs(Number(t.quantity)), 0);

  return (
    <div className="min-h-full bg-[#08111f] text-slate-100">

      {/* ── hero header ───────────────────────────────────────────────── */}
      <section className="border-b border-white/[0.07] bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.12),_transparent_55%),linear-gradient(135deg,#0b1728,#08111f)] px-5 py-7 sm:px-8">
        <div className="mx-auto max-w-6xl">
          {/* breadcrumb */}
          <div className="mb-5 flex items-center gap-2 text-xs text-slate-500">
            <Link href="/inventory/stock-items" className="flex items-center gap-1.5 hover:text-slate-300 transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" />
              Stock Items
            </Link>
            <span>/</span>
            <span className="text-slate-400">{item.name}</span>
          </div>

          <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            {/* title block */}
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-indigo-400/20 bg-indigo-400/10 p-3.5 shrink-0">
                <Package className="h-7 w-7 text-indigo-300" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{item.name}</h1>
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider ${statusColour}`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusLabel}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400">
                  <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" />{item.warehouse?.name}</span>
                  {item.inventoryCategory && (
                    <span className="flex items-center gap-1.5"><FolderOpen className="h-3.5 w-3.5" />{item.inventoryCategory.name}</span>
                  )}
                  <span className="flex items-center gap-1.5"><Scale className="h-3.5 w-3.5" />{formatUnit(item.baseUnit)} base unit</span>
                </div>
              </div>
            </div>

            {/* action buttons */}
            <div className="flex shrink-0 gap-2.5">
              <Link
                href={`/inventory/reconciliation?item=${item.id}`}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[.08] transition-colors"
              >
                <ClipboardList className="h-4 w-4" />
                Adjust
              </Link>
              <Link
                href={`/inventory/stock-items/${item.id}/edit`}
                className="inline-flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 transition-colors"
              >
                <Edit3 className="h-4 w-4" />
                Edit Item
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── main content ───────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl space-y-6 px-5 py-6 sm:px-8">

        {/* KPI strip */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* qty on hand */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Qty On Hand</p>
              <div className="rounded-xl bg-indigo-400/10 p-2 text-indigo-300"><Package className="h-4 w-4" /></div>
            </div>
            <p className="mt-4 text-3xl font-bold text-white tabular-nums">{qty.toFixed(2)}</p>
            <p className="mt-0.5 text-xs text-slate-500">{formatUnit(item.baseUnit)}</p>
            {/* reorder gauge */}
            {stockPct !== null && (
              <div className="mt-3">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
                  <div
                    className={`h-full rounded-full transition-all ${isOut ? 'bg-rose-500' : isLow ? 'bg-amber-400' : 'bg-emerald-400'}`}
                    style={{ width: `${stockPct}%` }}
                  />
                </div>
                <p className="mt-1 text-[10px] text-slate-600">Reorder at {reorder?.toFixed(2)} {formatUnit(item.baseUnit)}</p>
              </div>
            )}
          </div>

          {/* total value */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Stock Value</p>
              <div className="rounded-xl bg-emerald-400/10 p-2 text-emerald-300"><BarChart2 className="h-4 w-4" /></div>
            </div>
            <p className="mt-4 text-3xl font-bold text-white">{money(totalValue)}</p>
            <p className="mt-0.5 text-xs text-slate-500">qty × cost price</p>
          </div>

          {/* cost price */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Cost Price</p>
              <div className="rounded-xl bg-amber-400/10 p-2 text-amber-300"><Tag className="h-4 w-4" /></div>
            </div>
            <p className="mt-4 text-3xl font-bold text-white">{money(cost)}</p>
            <p className="mt-0.5 text-xs text-slate-500">per {formatUnit(item.baseUnit)}</p>
          </div>

          {/* tx summary */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5">
            <div className="flex items-start justify-between">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">Movement (last 50)</p>
              <div className="rounded-xl bg-violet-400/10 p-2 text-violet-300"><TrendingUp className="h-4 w-4" /></div>
            </div>
            <div className="mt-4 flex items-end gap-3">
              <div>
                <p className="text-xs text-emerald-400 font-semibold">IN</p>
                <p className="text-xl font-bold text-white tabular-nums">+{inflow.toFixed(1)}</p>
              </div>
              <div className="mb-0.5 text-slate-600">/</div>
              <div>
                <p className="text-xs text-rose-400 font-semibold">OUT</p>
                <p className="text-xl font-bold text-white tabular-nums">−{outflow.toFixed(1)}</p>
              </div>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">{formatUnit(item.baseUnit)}</p>
          </div>
        </div>

        {/* ── two-column body ─────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">

          {/* ── left: item details card ────────────────────────────── */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-6">
              <h3 className="mb-5 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Item Details</h3>
              <dl className="space-y-4 text-sm">
                {[
                  { label: 'SKU',          icon: <Hash className="h-3.5 w-3.5" />,   value: item.sku      || '—' },
                  { label: 'Barcode',      icon: <Scan className="h-3.5 w-3.5" />,   value: item.barcode  || '—' },
                  { label: 'Category',     icon: <FolderOpen className="h-3.5 w-3.5" />, value: item.inventoryCategory?.name || 'Uncategorized' },
                  { label: 'Stock Type',   icon: <Tag className="h-3.5 w-3.5" />,    value: item.stockType.replace(/_/g, ' ') },
                  { label: 'Reorder At',   icon: <AlertTriangle className="h-3.5 w-3.5" />, value: reorder ? `${reorder.toFixed(2)} ${formatUnit(item.baseUnit)}` : 'Not set' },
                  { label: 'Status',       icon: <CheckCircle2 className="h-3.5 w-3.5" />, value: item.isActive ? 'Active' : 'Inactive' },
                ].map(row => (
                  <div key={row.label} className="flex items-start justify-between gap-3 border-b border-white/[0.05] pb-3 last:border-none last:pb-0">
                    <dt className="flex items-center gap-1.5 text-slate-500 shrink-0">{row.icon}{row.label}</dt>
                    <dd className="text-right font-medium text-slate-200 break-all">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* purchase units card */}
            {item.stockUnits && item.stockUnits.length > 0 && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-6">
                <h3 className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Purchase Units</h3>
                <div className="space-y-2.5">
                  {/* base unit */}
                  <div className="flex items-center justify-between rounded-xl border border-indigo-400/15 bg-indigo-400/[.05] px-3.5 py-2.5 text-sm">
                    <span className="font-semibold text-indigo-200">{formatUnit(item.baseUnit)}</span>
                    <span className="text-[11px] text-slate-500">Base unit</span>
                  </div>
                  {item.stockUnits.map(u => (
                    <div key={u.id} className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-2.5 text-sm">
                      <span className="font-medium text-slate-200">{formatUnit(u.unit)}</span>
                      <span className="text-xs text-slate-500">= {Number(u.unitsInBase)} {formatUnit(item.baseUnit)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── right: transactions ────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-6 py-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Transaction Ledger</p>
                <p className="mt-0.5 text-sm font-semibold text-white">Recent {transactions.length} entries</p>
              </div>
              <Clock className="h-4 w-4 text-slate-600" />
            </div>

            {transactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-600">
                <ClipboardList className="h-10 w-10" />
                <p className="text-sm">No transactions recorded yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['Date & Time', 'Source', 'Qty Change', 'Balance', 'Reference'].map(h => (
                        <th key={h} className={`px-5 py-3 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500 ${h === 'Qty Change' || h === 'Balance' ? 'text-right' : 'text-left'}`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, i) => {
                      const qtyNum   = Number(tx.quantity);
                      const positive = qtyNum > 0;
                      const zero     = qtyNum === 0;
                      return (
                        <tr
                          key={tx.id}
                          className={`border-b border-white/[0.04] transition-colors hover:bg-white/[0.02] ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                        >
                          {/* date */}
                          <td className="whitespace-nowrap px-5 py-3.5 text-slate-400">
                            <span className="text-slate-200">{tx.timestamp.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            <span className="ml-1.5 text-xs text-slate-600">{tx.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </td>

                          {/* source badge */}
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${txBadge(tx.source)}`}>
                              {tx.source.replace(/_/g, ' ')}
                            </span>
                          </td>

                          {/* qty change */}
                          <td className="px-5 py-3.5 text-right">
                            <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${positive ? 'text-emerald-300' : zero ? 'text-slate-500' : 'text-rose-300'}`}>
                              {positive ? <TrendingUp className="h-3.5 w-3.5" /> : zero ? <Minus className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                              {positive ? '+' : ''}{qtyNum.toFixed(2)}
                            </span>
                          </td>

                          {/* balance after */}
                          <td className="px-5 py-3.5 text-right font-semibold text-slate-200 tabular-nums">
                            {Number(tx.quantityAfter).toFixed(2)}
                          </td>

                          {/* reference */}
                          <td className="max-w-[160px] truncate px-5 py-3.5 text-xs text-slate-500">
                            {tx.reference || tx.notes || <span className="text-slate-700">—</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
