'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowRight, CheckCircle2,
  ChevronDown, CircleCheck, Info, Loader2, MapPin, Package, Plus, Search,
  Send, ShieldCheck, Trash2, X,
} from 'lucide-react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { INVENTORY_UNITS, formatUnit, purchaseSetup, toPurchaseQuantity } from '@/lib/inventory/units';

/* ─── types ──────────────────────────────────────────────────────────────── */
interface Warehouse { id: string; name: string; posOutlet?: { id: string; name: string } | null }
interface StockItem { id: string; name: string; stockType?: string; baseUnit: string; quantityOnHand: number; warehouseId: string; stockUnits?: { unit: string; unitsInBase: number | string; isPurchaseUnit?: boolean }[] }

/* ─── constants ──────────────────────────────────────────────────────────── */
const STOCK_STAFF    = new Set(['STOCK_MANAGER', 'STOCK_KEEPER']);
const TOP_MGMT       = new Set(['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'GENERAL_MANAGER', 'ACCOUNTANT', 'GENERAL_CASHIER']);

/* ─── ComboBox ───────────────────────────────────────────────────────────── */
interface ComboBoxProps {
  label: string; placeholder: string; value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; sub?: string }[];
  disabled?: boolean; required?: boolean;
}

function ComboBox({ label, placeholder, value, onChange, options, disabled, required }: ComboBoxProps) {
  const [open, setOpen]     = useState(false);
  const [q, setQ]           = useState('');
  const ref                 = useRef<HTMLDivElement>(null);
  const inputRef            = useRef<HTMLInputElement>(null);
  const filtered            = options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()) || (o.sub || '').toLowerCase().includes(q.toLowerCase()));
  const selected            = options.find(o => o.value === value);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setQ(''); } };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <div ref={ref} className="relative">
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
        {label}{required && <span className="ml-0.5 text-emerald-400">*</span>}
      </p>
      <button type="button" disabled={disabled} onClick={() => { if (!disabled) { setOpen(true); setTimeout(() => inputRef.current?.focus(), 30); } }}
        className={['flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-sm transition-all',
          open ? 'border-emerald-400/60 bg-[#0d1e35] shadow-[0_0_0_3px_rgba(52,211,153,0.10)]' : 'border-white/10 bg-[#0d1832]',
          disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:border-white/20',
        ].join(' ')}>
        <span className={selected ? 'truncate text-slate-100' : 'truncate text-slate-500'}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d1e35] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)} placeholder="Search…" className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none" />
            {q && <button type="button" onClick={() => setQ('')}><X className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300" /></button>}
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0
              ? <li className="px-4 py-3 text-sm text-slate-500">No results</li>
              : filtered.map(o => (
                <li key={o.value}>
                  <button type="button" onClick={() => { onChange(o.value); setOpen(false); setQ(''); }}
                    className={['flex w-full flex-col items-start px-4 py-2.5 text-left transition-colors hover:bg-white/[0.05]', o.value === value ? 'bg-emerald-400/[0.08]' : ''].join(' ')}>
                    <span className={`text-sm font-medium ${o.value === value ? 'text-emerald-300' : 'text-slate-200'}`}>{o.label}</span>
                    {o.sub && <span className="mt-0.5 text-[11px] text-slate-500">{o.sub}</span>}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/* ─── main ───────────────────────────────────────────────────────────────── */
export default function NewTransferPage() {
  const router                            = useRouter();
  const searchParams                      = useSearchParams();
  const { data: session }                 = useLodgeCoreSession();
  const [warehouses, setWarehouses]       = useState<Warehouse[]>([]);
  const [stockItems, setStockItems]       = useState<StockItem[]>([]);
  const [fromWarehouseId, setFrom]        = useState('');
  const [toWarehouseId, setTo]            = useState('');
  const [notes, setNotes]                 = useState('');
  const [lines, setLines]                 = useState([{ stockItemId: '', quantity: '', unitOfMeasure: 'PIECE', notes: '' }]);
  const [selfIssue, setSelfIssue]         = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [error, setError]                 = useState('');
  const [success, setSuccess]             = useState('');
  const issueToOutlet                     = searchParams.get('issue') === 'outlet';

  const userRole    = String(session?.user?.role || '').toUpperCase();
  const isFnbMgr    = userRole === 'FNB_MANAGER';
  const isStockStaff = STOCK_STAFF.has(userRole);
  const isTopMgmt   = TOP_MGMT.has(userRole);
  const isSuperAdmin = Boolean(session?.user && 'isSuperAdmin' in session.user && session.user.isSuperAdmin);

  useEffect(() => {
    fetch('/api/v1/inventory/warehouses').then(r => r.json()).then(r => {
      const loaded = r.data?.warehouses || r.data || [];
      setWarehouses(loaded);
      if (issueToOutlet) {
        const mainWarehouse = loaded.find((warehouse: Warehouse) => !warehouse.posOutlet);
        if (mainWarehouse) setFrom(mainWarehouse.id);
      }
    });
  }, [issueToOutlet]);

  // Load only the selected source warehouse. The previous broad 500-row
  // request could omit valid mother-warehouse items before the browser
  // filtered the response, especially for properties with many stock rows.
  useEffect(() => {
    if (!fromWarehouseId) {
      setStockItems([]);
      return;
    }
    fetch(`/api/v1/inventory/stock-items?warehouseId=${encodeURIComponent(fromWarehouseId)}&limit=500`)
      .then(r => r.json())
      .then(r => setStockItems(r.data?.items || []))
      .catch(() => setStockItems([]));
  }, [fromWarehouseId]);

  const sourceWarehouses  = warehouses.filter(w => !w.posOutlet);
  const destWarehouses    = warehouses.filter(w => w.id !== fromWarehouseId && (issueToOutlet ? Boolean(w.posOutlet) : !w.posOutlet));

  // Never expose the combined stock-item feed before a source is selected.
  // For an outlet issue, this guarantees that item availability comes only
  // from the selected main warehouse, never from an outlet warehouse.
  const fromItems = fromWarehouseId ? stockItems.filter(i => i.warehouseId === fromWarehouseId && Number(i.quantityOnHand) > 0) : [];
  const selectedFrom = warehouses.find(w => w.id === fromWarehouseId);
  const selectedTo = warehouses.find(w => w.id === toWarehouseId);
  const selectedLineCount = lines.filter(line => line.stockItemId && line.quantity).length;

  const itemPurchaseUnit = (item?: StockItem) => item ? purchaseSetup(item.baseUnit, item.stockUnits || []) : { unit: 'PIECE', unitsInBase: 1 };

  const unitsForItem = (stockItemId: string) => {
    const item = stockItems.find(i => i.id === stockItemId);
    if (!item) return INVENTORY_UNITS as readonly string[];
    const purchase = itemPurchaseUnit(item).unit;
    return [purchase, item.baseUnit, ...(item.stockUnits?.map(u => u.unit).filter(u => u !== item.baseUnit && u !== purchase) || [])];
  };

  const addLine    = () => setLines(l => [...l, { stockItemId: '', quantity: '', unitOfMeasure: 'PIECE', notes: '' }]);
  const removeLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: string, value: string) =>
    setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: value } : ln));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!fromWarehouseId || !toWarehouseId) { setError('Please select both source and destination.'); return; }
    if (fromWarehouseId === toWarehouseId)  { setError('Source and destination must be different.'); return; }
    if (lines.some(l => !l.stockItemId || !l.quantity)) { setError('All lines must have an item and quantity.'); return; }

    setShowConfirmation(true);
  }

  async function confirmSubmit() {
    setIsSubmitting(true);
    const res  = await fetch('/api/v1/inventory/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromWarehouseId, toWarehouseId, notes, selfIssue, outletIssue: issueToOutlet, items: lines.map(l => ({ stockItemId: l.stockItemId, quantity: parseFloat(l.quantity), unitOfMeasure: l.unitOfMeasure, notes: l.notes })) }),
    });
    const json = await res.json();
    if (!res.ok || json.error) { setError(json.error || 'Failed to create transfer'); setIsSubmitting(false); }
    else { router.push(`/inventory/transfers/${json.data.id}`); }
  }

  /* ── role-context banner ─────────────────────────────────────────────── */
  const flowBanner = isFnbMgr ? (
      <div className="flex gap-3 rounded-xl border border-violet-400/20 bg-violet-400/[0.07] p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
        <div>
          <p className="text-sm font-semibold text-violet-200">Stock request — F&amp;B Manager</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Your request will be sent to the Stock Manager for approval and dispatch. You will receive/confirm the stock once it is issued to your outlet.</p>
        </div>
      </div>
    ) : null;

  /* ── submit label ────────────────────────────────────────────────────── */
  const submitLabel = () => {
    if (isSubmitting) return <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>;
    if (isFnbMgr)     return <><Send className="h-4 w-4" />Submit request</>;
    return <><ArrowRight className="h-4 w-4" />Create transfer</>;
  };

  return (
    <div className="min-h-full bg-[#07101d] text-slate-100">
      <section className="relative overflow-hidden border-b border-white/[0.07] bg-[radial-gradient(circle_at_78%_-10%,rgba(16,185,129,.19),transparent_32%),radial-gradient(circle_at_10%_0%,rgba(99,102,241,.16),transparent_30%),linear-gradient(135deg,#0b1728,#07101d)] px-5 pb-7 pt-6 sm:px-8 sm:pt-8">
        <div className="pointer-events-none absolute -bottom-24 right-16 h-64 w-64 rounded-full bg-emerald-400/[0.06] blur-3xl" />
        <div className="relative mx-auto max-w-[1260px]">
          <div className="mb-8 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500"><ArrowLeftRight className="h-4 w-4 text-emerald-300" /> Inventory <span className="text-slate-700">/</span> <span className="text-emerald-300">New movement</span></div>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200"><ArrowDownToLine className="h-3.5 w-3.5" /> {issueToOutlet ? 'Outlet issue' : 'Stock movement'}</div>
              <h1 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{isFnbMgr ? 'Request stock from warehouse' : issueToOutlet ? 'Issue stock to outlet' : 'New stock transfer'}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">{isFnbMgr ? 'Create a controlled request for your outlet. The Stock Manager will review, approve, and dispatch the items.' : issueToOutlet ? 'Prepare an auditable stock issue from your main warehouse to an operating outlet.' : 'Move stock between controlled storage locations with a clear custody trail.'}</p>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-slate-400 backdrop-blur-sm"><ShieldCheck className="h-4 w-4 text-emerald-300" /><span><strong className="block text-slate-200">Controlled movement</strong>Every issue is recorded in the stock ledger</span></div>
          </div>
          <div className="mt-8 grid max-w-2xl grid-cols-3 gap-2 sm:gap-3">{[['01', 'Route'], ['02', 'Items'], ['03', 'Submit']].map(([number, label], index) => <div key={number} className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${index === 0 ? 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-200' : 'border-white/[0.07] bg-white/[0.025] text-slate-500'}`}><span className="font-mono text-[10px]">{number}</span><span className="text-xs font-semibold">{label}</span>{index < 2 && <ArrowRight className="ml-auto h-3 w-3 opacity-40" />}</div>)}</div>
        </div>
      </section>

      <main className="mx-auto max-w-[1260px] space-y-5 px-5 py-6 sm:px-8 lg:py-8">
        {flowBanner}

        {/* alerts */}
        {error   && <div className="flex gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.08] p-3.5 text-sm text-rose-200"><AlertTriangle className="h-5 w-5 shrink-0" />{error}</div>}
        {success && <div className="flex gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-3.5 text-sm text-emerald-200"><CheckCircle2 className="h-5 w-5 shrink-0" />{success}</div>}

        <form onSubmit={handleSubmit} className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">

          {/* route selection */}
          <div className="rounded-[24px] border border-white/[0.09] bg-[linear-gradient(145deg,#122138,#0f1b2d)] p-5 shadow-[0_16px_45px_rgba(0,0,0,.12)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-300/10 text-cyan-200"><MapPin className="h-3.5 w-3.5" /></span><p className="text-sm font-semibold text-white">{isFnbMgr ? 'Warehouse → Outlet' : 'Define the movement route'}</p></div>
                <p className="mt-2 text-xs text-slate-500">{isFnbMgr ? 'Choose the source warehouse and your outlet.' : 'Select where stock leaves from and where it is going.'}</p>
              </div>
              <span className="rounded-lg border border-white/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Required</span>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-[1fr_44px_1fr] md:items-end">
              <ComboBox
                label="From warehouse"
                placeholder="Choose a warehouse…"
                value={fromWarehouseId}
                onChange={v => { setFrom(v); setLines([{ stockItemId: '', quantity: '', unitOfMeasure: 'PIECE', notes: '' }]); }}
                options={sourceWarehouses.map(w => ({ value: w.id, label: w.name, sub: w.posOutlet ? `Outlet: ${w.posOutlet.name}` : 'Main warehouse' }))}
                required
              />
              <div className="hidden h-11 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-500 md:flex"><ArrowRight className="h-4 w-4" /></div>
              <ComboBox
                label={isFnbMgr ? 'To outlet' : 'To main warehouse'}
                placeholder={isFnbMgr ? 'Choose your outlet…' : 'Choose destination…'}
                value={toWarehouseId}
                onChange={setTo}
                options={destWarehouses.map(w => ({ value: w.id, label: w.posOutlet ? w.posOutlet.name : w.name, sub: w.posOutlet ? 'Outlet warehouse' : 'Main warehouse' }))}
                required
              />
            </div>

            {(selectedFrom || selectedTo) && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-white/[0.07] pt-4 text-xs"><span className="rounded-lg bg-cyan-300/10 px-2.5 py-1.5 font-medium text-cyan-200">{selectedFrom?.name || 'Source pending'}</span><ArrowRight className="h-3.5 w-3.5 text-slate-600" /><span className="rounded-lg bg-emerald-300/10 px-2.5 py-1.5 font-medium text-emerald-200">{selectedTo ? (selectedTo.posOutlet?.name || selectedTo.name) : 'Destination pending'}</span></div>}

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Notes / reason</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional reason or transfer note…"
                className="w-full resize-none rounded-xl border border-white/10 bg-[#0d1832] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 transition-all focus:border-emerald-400/60 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.10)]" />
            </div>
          </div>

          {/* line items */}
          <div className="rounded-[24px] border border-white/[0.09] bg-[#111c2e] p-5 shadow-[0_16px_45px_rgba(0,0,0,.10)] sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-300/10 text-violet-200"><Package className="h-3.5 w-3.5" /></span><p className="text-sm font-semibold text-white">Items to transfer</p></div>
                <p className="mt-2 text-xs text-slate-500">Add the stock lines that should move with this request.</p>
              </div>
              <button type="button" onClick={addLine} className="flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-300 transition-colors hover:bg-emerald-400/20">
                <Plus className="h-3.5 w-3.5" /> Add item
              </button>
            </div>

            <div className="space-y-2.5">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-2xl border border-white/[0.07] bg-[#0b1729] p-3 sm:gap-3">
                  {/* searchable item combobox */}
                  <div className="col-span-12 sm:col-span-5">
                    <ComboBox
                      label=""
                      placeholder="Select item…"
                      value={line.stockItemId}
                      onChange={value => {
                        const sel = fromItems.find(item => item.id === value);
                        const purchase = itemPurchaseUnit(sel);
                        setLines(cur => cur.map((ln, idx) => idx === i ? { ...ln, stockItemId: value, unitOfMeasure: purchase.unit } : ln));
                      }}
                      required
                      options={fromItems.map(item => ({
                        value: item.id,
                        label: item.name,
                        sub: `${toPurchaseQuantity(item.quantityOnHand, item.baseUnit, item.stockUnits || []).toFixed(2)} ${formatUnit(itemPurchaseUnit(item).unit)} available · ${formatUnit(item.baseUnit)} base`,
                      }))}
                    />
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Quantity</label>
                    <input type="number" step="0.001" min="0.001" value={line.quantity}
                      onChange={e => updateLine(i, 'quantity', e.target.value)} required placeholder="Qty"
                      className="h-10 w-full rounded-lg border border-white/10 bg-[#08111f] px-2.5 text-sm text-white outline-none focus:border-emerald-400/60" />
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Unit</label>
                    <select value={line.unitOfMeasure} onChange={e => updateLine(i, 'unitOfMeasure', e.target.value)}
                      className="h-10 w-full rounded-lg border border-white/10 bg-[#08111f] px-2.5 text-sm text-slate-200 outline-none focus:border-emerald-400/60">
                      {unitsForItem(line.stockItemId).map(u => <option key={u} value={u}>{formatUnit(u)}</option>)}
                    </select>
                  </div>
                  <div className="col-span-10 sm:col-span-2">
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">Line note</label>
                    <input type="text" value={line.notes} onChange={e => updateLine(i, 'notes', e.target.value)} placeholder="Notes…"
                      className="h-10 w-full rounded-lg border border-white/10 bg-[#08111f] px-2.5 text-sm text-slate-300 outline-none focus:border-emerald-400/60" />
                  </div>
                  <div className="col-span-2 flex h-10 items-center justify-center sm:col-span-1">
                    {lines.length > 1 && (
                      <button type="button" onClick={() => removeLine(i)} className="rounded-lg p-1.5 text-slate-600 hover:bg-rose-500/10 hover:text-rose-400 transition-colors">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          </div>

          <aside className="sticky top-5 space-y-4">
            <div className="overflow-hidden rounded-[24px] border border-emerald-300/20 bg-[linear-gradient(155deg,rgba(16,185,129,.13),rgba(17,28,46,.98)_48%)] shadow-[0_18px_50px_rgba(0,0,0,.18)]">
              <div className="border-b border-white/[0.08] p-5"><div className="flex items-center justify-between"><p className="text-sm font-semibold text-white">Movement review</p><CircleCheck className="h-4 w-4 text-emerald-300" /></div><p className="mt-1 text-xs text-slate-500">Check the details before submitting.</p></div>
              <div className="space-y-4 p-5"><div><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500">Route</p><p className="mt-1 text-sm font-medium text-slate-200">{selectedFrom?.name || 'Select source'} <span className="mx-1 text-slate-600">→</span> {selectedTo?.posOutlet?.name || selectedTo?.name || 'Select destination'}</p></div><div className="flex items-center justify-between border-t border-white/[0.07] pt-4"><span className="text-xs text-slate-500">Item lines ready</span><span className="font-mono text-sm font-semibold text-emerald-200">{selectedLineCount} / {lines.length}</span></div><div className="flex items-center justify-between"><span className="text-xs text-slate-500">Available source items</span><span className="font-mono text-sm font-semibold text-slate-200">{fromItems.length}</span></div><div className="rounded-xl border border-amber-300/15 bg-amber-300/[0.06] p-3 text-xs leading-5 text-amber-100/75"><ShieldCheck className="mr-1.5 inline h-3.5 w-3.5 text-amber-200" />The movement will follow your property’s approval and custody workflow.</div></div>
              <div className="border-t border-white/[0.08] bg-black/10 p-4"><button type="submit" disabled={isSubmitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-[#06151a] shadow-[0_8px_24px_rgba(52,211,153,.18)] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">{submitLabel()}</button><button type="button" onClick={() => router.back()} className="mt-3 w-full text-center text-xs font-medium text-slate-500 transition-colors hover:text-slate-300">Cancel and return</button></div>
            </div>
          </aside>
        </form>
      </main>

      {showConfirmation && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-labelledby="transfer-confirmation-title">
        <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-white/[0.12] bg-[#101c2f] shadow-[0_28px_100px_rgba(0,0,0,.55)]">
          <div className="relative border-b border-white/[0.08] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,.2),transparent_55%),linear-gradient(135deg,#14283a,#101c2f)] px-6 pb-5 pt-6 sm:px-7">
            <button type="button" onClick={() => setShowConfirmation(false)} className="absolute right-5 top-5 rounded-lg p-2 text-slate-500 transition-colors hover:bg-white/[0.07] hover:text-white" aria-label="Close confirmation"><X className="h-4 w-4" /></button>
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-200"><CircleCheck className="h-5 w-5" /></div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-300">Final review</p>
            <h2 id="transfer-confirmation-title" className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-white">Confirm stock movement</h2>
            <p className="mt-2 max-w-md text-sm leading-5 text-slate-400">Review the route and item quantities below. This will create a controlled transfer request in the stock ledger.</p>
          </div>
          <div className="space-y-4 p-6 sm:p-7">
            <div className="grid gap-3 sm:grid-cols-[1fr_36px_1fr] sm:items-center"><div className="rounded-2xl border border-cyan-300/15 bg-cyan-300/[0.06] p-3.5"><p className="text-[10px] font-bold uppercase tracking-wider text-cyan-200/70">From warehouse</p><p className="mt-1 text-sm font-semibold text-slate-100">{selectedFrom?.name || '—'}</p></div><ArrowRight className="mx-auto hidden h-4 w-4 text-slate-500 sm:block" /><div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.06] p-3.5"><p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200/70">To destination</p><p className="mt-1 text-sm font-semibold text-slate-100">{selectedTo?.posOutlet?.name || selectedTo?.name || '—'}</p></div></div>
            <div className="overflow-hidden rounded-2xl border border-white/[0.08]"><div className="flex items-center justify-between border-b border-white/[0.08] bg-white/[0.025] px-4 py-3"><span className="text-xs font-semibold text-slate-300">Items being moved</span><span className="text-xs text-slate-500">{selectedLineCount} line{selectedLineCount === 1 ? '' : 's'}</span></div><div className="divide-y divide-white/[0.06]">{lines.filter(line => line.stockItemId && line.quantity).map((line, index) => { const item = stockItems.find(stockItem => stockItem.id === line.stockItemId); return <div key={`${line.stockItemId}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3"><div className="min-w-0"><p className="truncate text-sm font-medium text-slate-200">{item?.name || 'Selected item'}</p><p className="mt-0.5 text-[11px] text-slate-500">{line.notes || 'No line note'}</p></div><span className="shrink-0 rounded-lg bg-white/[0.06] px-2.5 py-1.5 font-mono text-xs font-semibold text-emerald-200">{line.quantity} {formatUnit(line.unitOfMeasure)}</span></div>; })}</div></div>
            {notes && <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] px-4 py-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Transfer note</p><p className="mt-1 text-sm text-slate-300">{notes}</p></div>}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowConfirmation(false)} className="rounded-xl border border-white/[0.1] px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors hover:bg-white/[0.06]">Back to edit</button><button type="button" onClick={confirmSubmit} disabled={isSubmitting} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-bold text-[#06151a] transition-colors hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">{isSubmitting ? <><Loader2 className="h-4 w-4 animate-spin" />Creating…</> : <><ShieldCheck className="h-4 w-4" />Confirm &amp; create</>}</button></div>
          </div>
        </div>
      </div>}
    </div>
  );
}
