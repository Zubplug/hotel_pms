'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Package, Save, Loader2, AlertTriangle,
  Hash, Scan, Tag, Building2, Scale, CheckCircle2, X,
} from 'lucide-react';

const STOCK_TYPES = [
  { value: 'SELLABLE',     label: 'Sellable / Resale' },
  { value: 'RAW_MATERIAL', label: 'Raw Material / Production' },
  { value: 'CONSUMABLE',   label: 'General Consumable' },
  { value: 'CLEANING',     label: 'Cleaning' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'ASSET',        label: 'Asset / Durable Equipment' },
  { value: 'PACKAGING',    label: 'Packaging' },
];

/* ─── shared input styles ──────────────────────────────────────────────────── */
const inputCls = [
  'h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white',
  'outline-none placeholder:text-slate-600',
  'transition-all focus:border-indigo-400/60 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]',
].join(' ');

const disabledCls = [
  'h-11 w-full rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 text-sm text-slate-500',
  'cursor-not-allowed select-none flex items-center',
].join(' ');

const labelCls = 'mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500';

export default function EditStockItemPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();

  const [item, setItem]       = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    fetch(`/api/v1/inventory/stock-items/${params.id}`)
      .then(r => r.json())
      .then(d => setItem(d.data))
      .catch(() => setError('Failed to load item'));
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSaved(false);

    const fd = new FormData(e.currentTarget);
    const data = {
      name:         fd.get('name'),
      stockType:    fd.get('stockType'),
      reorderLevel: fd.get('reorderLevel') ? parseFloat(fd.get('reorderLevel') as string) : null,
      isActive:     fd.get('isActive') === 'on',
    };

    try {
      const res = await fetch(`/api/v1/inventory/stock-items/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update item');
      setSaved(true);
      setTimeout(() => {
        router.push(`/inventory/stock-items/${params.id}`);
        router.refresh();
      }, 800);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  /* ── loading skeleton ─────────────────────────────────────────────────── */
  if (!item) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[#08111f]">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm">Loading item…</p>
        </div>
      </div>
    );
  }

  const money = (v: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(v);

  return (
    <div className="min-h-full bg-[#08111f] text-slate-100">

      {/* ── hero header ───────────────────────────────────────────────── */}
      <section className="border-b border-white/[0.07] bg-[radial-gradient(ellipse_at_top_right,_rgba(99,102,241,0.10),_transparent_55%),linear-gradient(135deg,#0b1728,#08111f)] px-5 py-7 sm:px-8">
        <div className="mx-auto max-w-3xl">

          {/* breadcrumb */}
          <div className="mb-5 flex items-center gap-2 text-xs text-slate-500">
            <Link href="/inventory/stock-items" className="hover:text-slate-300 transition-colors">Stock Items</Link>
            <span>/</span>
            <Link href={`/inventory/stock-items/${params.id}`} className="hover:text-slate-300 transition-colors">{item.name}</Link>
            <span>/</span>
            <span className="text-slate-400">Edit</span>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <Link
                href={`/inventory/stock-items/${params.id}`}
                className="rounded-xl border border-white/10 bg-white/[.04] p-2.5 text-slate-400 hover:bg-white/[.08] hover:text-slate-200 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <div className="rounded-xl border border-indigo-400/20 bg-indigo-400/10 p-2.5">
                    <Package className="h-5 w-5 text-indigo-300" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.15em] text-indigo-400">Editing item</p>
                    <h1 className="text-xl font-bold text-white sm:text-2xl">{item.name}</h1>
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5"><Building2 className="h-3 w-3" />{item.warehouse?.name}</span>
                  <span className="flex items-center gap-1.5"><Scale className="h-3 w-3" />Base: {item.baseUnit}</span>
                  <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${item.isActive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-rose-400/10 text-rose-300'}`}>
                    {item.isActive ? <CheckCircle2 className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                    {item.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── form body ─────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-3xl px-5 py-6 sm:px-8">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* alerts */}
          {error && (
            <div className="flex items-start gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[.07] p-4 text-sm text-rose-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[.07] p-4 text-sm text-emerald-200">
              <CheckCircle2 className="h-4 w-4 shrink-0" />Saved! Redirecting…
            </div>
          )}

          {/* ── editable fields card ──────────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-6">
            <h2 className="mb-5 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">Item Details</h2>

            <div className="grid gap-5 sm:grid-cols-2">

              {/* name — full width */}
              <div className="sm:col-span-2">
                <label htmlFor="name" className={labelCls}>Item Name <span className="text-indigo-400">*</span></label>
                <input
                  required id="name" name="name" type="text"
                  defaultValue={item.name}
                  placeholder="e.g. Heineken Bottle"
                  className={inputCls}
                />
              </div>

              {/* SKU */}
              <div>
                <label className={labelCls}>
                  <span className="flex items-center gap-1.5"><Hash className="h-3 w-3" />SKU</span>
                </label>
                <div className={disabledCls}>{item.sku || '—'}</div>
              </div>

              {/* barcode */}
              <div>
                <label className={labelCls}>
                  <span className="flex items-center gap-1.5"><Scan className="h-3 w-3" />Barcode</span>
                </label>
                <div className={disabledCls}>{item.barcode || '—'}</div>
              </div>

              {/* stock type */}
              <div>
                <label htmlFor="stockType" className={labelCls}>
                  <span className="flex items-center gap-1.5"><Tag className="h-3 w-3" />Stock Type <span className="text-indigo-400">*</span></span>
                </label>
                <select
                  required id="stockType" name="stockType"
                  defaultValue={item.stockType || 'CONSUMABLE'}
                  className={inputCls + ' pr-10 appearance-none'}
                >
                  {STOCK_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* reorder level */}
              <div>
                <label htmlFor="reorderLevel" className={labelCls}>
                  <span className="flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" />Reorder Level</span>
                </label>
                <input
                  id="reorderLevel" name="reorderLevel" type="number"
                  min="0" step="0.01"
                  defaultValue={item.reorderLevel || ''}
                  placeholder="Alert threshold quantity"
                  className={inputCls}
                />
              </div>

              {/* active toggle — full width */}
              <div className="sm:col-span-2">
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3.5 transition-colors hover:bg-white/[0.04]">
                  <input
                    id="isActive" name="isActive" type="checkbox"
                    defaultChecked={item.isActive}
                    className="h-4 w-4 rounded border-slate-600 bg-[#0d1832] text-indigo-500 focus:ring-indigo-500 focus:ring-offset-0"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-200">Item is active</p>
                    <p className="text-xs text-slate-500">Inactive items are hidden from stock operations</p>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* ── read-only reference card ───────────────────────────────── */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-6">
            <h2 className="mb-5 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">System Reference (Read-only)</h2>
            <div className="grid gap-5 sm:grid-cols-2">

              <div>
                <label className={labelCls}>Warehouse</label>
                <div className={disabledCls}>{item.warehouse?.name}</div>
              </div>

              <div>
                <label className={labelCls}>Base Unit</label>
                <div className={disabledCls}>{item.baseUnit}</div>
              </div>

              <div className="sm:col-span-2">
                <label className={labelCls}>Current MAC Cost Price</label>
                <div className={disabledCls + ' justify-between'}>
                  <span>{money(Number(item.costPrice))}</span>
                  <span className="text-xs text-slate-600 font-normal">System Computed · Updated on GRN</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── footer actions ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#111c2e] px-6 py-4">
            <Link
              href={`/inventory/stock-items/${params.id}`}
              className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.04] hover:text-slate-200 transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || saved}
              className="flex items-center gap-2 rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" />Saving…</>
              ) : saved ? (
                <><CheckCircle2 className="h-4 w-4" />Saved!</>
              ) : (
                <><Save className="h-4 w-4" />Save Changes</>
              )}
            </button>
          </div>

        </form>
      </main>
    </div>
  );
}
