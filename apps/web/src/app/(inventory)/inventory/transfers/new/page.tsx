'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle, ArrowLeftRight, ArrowRight, CheckCircle2,
  ChevronDown, Info, Loader2, Plus, Search, Send, Trash2, X,
} from 'lucide-react';
import { useLodgeCoreSession } from '@/lib/auth/useLodgeCoreSession';
import { INVENTORY_UNITS, formatUnit } from '@/lib/inventory/units';

/* ─── types ──────────────────────────────────────────────────────────────── */
interface Warehouse { id: string; name: string; posOutlet?: { id: string; name: string } | null }
interface StockItem { id: string; name: string; stockType?: string; baseUnit: string; quantityOnHand: number; warehouseId: string; stockUnits?: { unit: string }[] }

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
  const { data: session }                 = useLodgeCoreSession();
  const [warehouses, setWarehouses]       = useState<Warehouse[]>([]);
  const [stockItems, setStockItems]       = useState<StockItem[]>([]);
  const [fromWarehouseId, setFrom]        = useState('');
  const [toWarehouseId, setTo]            = useState('');
  const [notes, setNotes]                 = useState('');
  const [lines, setLines]                 = useState([{ stockItemId: '', quantity: '', unitOfMeasure: 'PIECE', notes: '' }]);
  const [selfIssue, setSelfIssue]         = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [error, setError]                 = useState('');
  const [success, setSuccess]             = useState('');

  const userRole    = String(session?.user?.role || '').toUpperCase();
  const isFnbMgr    = userRole === 'FNB_MANAGER';
  const isStockStaff = STOCK_STAFF.has(userRole);
  const isTopMgmt   = TOP_MGMT.has(userRole);
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin;

  useEffect(() => {
    fetch('/api/v1/inventory/warehouses').then(r => r.json()).then(r => setWarehouses(r.data?.warehouses || r.data || []));
    fetch('/api/v1/inventory/stock-items?limit=500').then(r => r.json()).then(r => setStockItems(r.data?.items || []));
  }, []);

  // Source warehouses: restricted roles can only use main (non-outlet) warehouses
  const mainWarehouses    = warehouses.filter(w => !w.posOutlet);
  const outletWarehouses  = warehouses.filter(w => w.posOutlet);
  const mustUseMain       = isFnbMgr || isStockStaff;
  const sourceWarehouses  = mustUseMain ? mainWarehouses : warehouses;
  const destWarehouses    = isFnbMgr
    ? outletWarehouses.filter(w => w.id !== fromWarehouseId)
    : warehouses.filter(w => w.id !== fromWarehouseId);

  const fromItems = stockItems.filter(i => !fromWarehouseId || i.warehouseId === fromWarehouseId);

  const unitsForItem = (stockItemId: string) => {
    const item = stockItems.find(i => i.id === stockItemId);
    if (!item) return INVENTORY_UNITS as readonly string[];
    return [item.baseUnit, ...(item.stockUnits?.map(u => u.unit).filter(u => u !== item.baseUnit) || [])];
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

    setIsSubmitting(true);
    const res  = await fetch('/api/v1/inventory/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromWarehouseId, toWarehouseId, notes, selfIssue, items: lines.map(l => ({ stockItemId: l.stockItemId, quantity: parseFloat(l.quantity), unitOfMeasure: l.unitOfMeasure, notes: l.notes })) }),
    });
    const json = await res.json();
    if (!res.ok || json.error) { setError(json.error || 'Failed to create transfer'); setIsSubmitting(false); }
    else { router.push(`/inventory/transfers/${json.data.id}`); }
  }

  /* ── role-context banner ─────────────────────────────────────────────── */
  const FlowBanner = () => {
    if (isFnbMgr) return (
      <div className="flex gap-3 rounded-xl border border-violet-400/20 bg-violet-400/[0.07] p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-300" />
        <div>
          <p className="text-sm font-semibold text-violet-200">Stock request — F&amp;B Manager</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">Your request will be sent to the Stock Manager for approval and dispatch. You will receive/confirm the stock once it is issued to your outlet.</p>
        </div>
      </div>
    );
    if (isStockStaff) return (
      <div className="flex gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
        <div>
          <p className="text-sm font-semibold text-emerald-200">Stock Manager — transfer options</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">You can issue stock directly to an outlet (it will be marked as issued and top management will confirm receipt), or create a pending transfer request.</p>
        </div>
      </div>
    );
    return null;
  };

  /* ── submit label ────────────────────────────────────────────────────── */
  const submitLabel = () => {
    if (isSubmitting) return <><Loader2 className="h-4 w-4 animate-spin" />Processing…</>;
    if (isFnbMgr)     return <><Send className="h-4 w-4" />Submit request</>;
    if (selfIssue)    return <><Send className="h-4 w-4" />Issue stock now</>;
    return <><ArrowRight className="h-4 w-4" />Create transfer</>;
  };

  return (
    <div className="min-h-full bg-[#08111f] text-slate-100">
      {/* header */}
      <section className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_right,_rgba(139,92,246,0.14),_transparent_36%),linear-gradient(135deg,#0b1728,#08111f)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-violet-300">
            <ArrowLeftRight className="h-4 w-4" /> Stock movement
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            {isFnbMgr ? 'Request stock from warehouse' : 'New stock transfer'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            {isFnbMgr
              ? 'Request stock from the main warehouse to your outlet. Stock Manager will approve and dispatch.'
              : 'Move stock between warehouses or issue directly to an outlet.'}
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-4xl space-y-5 px-5 py-6 sm:px-8">
        <FlowBanner />

        {/* alerts */}
        {error   && <div className="flex gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.08] p-3.5 text-sm text-rose-200"><AlertTriangle className="h-5 w-5 shrink-0" />{error}</div>}
        {success && <div className="flex gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-3.5 text-sm text-emerald-200"><CheckCircle2 className="h-5 w-5 shrink-0" />{success}</div>}

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* route selection */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">{isFnbMgr ? 'Warehouse → Outlet' : 'Transfer route'}</p>
                <p className="mt-1 text-xs text-slate-500">{isFnbMgr ? 'Choose the source warehouse and your outlet.' : 'Select source and destination locations.'}</p>
              </div>
              <ArrowLeftRight className="h-4 w-4 text-slate-600" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <ComboBox
                label="From warehouse"
                placeholder="Choose a warehouse…"
                value={fromWarehouseId}
                onChange={v => { setFrom(v); setLines([{ stockItemId: '', quantity: '', unitOfMeasure: 'PIECE', notes: '' }]); }}
                options={sourceWarehouses.map(w => ({ value: w.id, label: w.name, sub: w.posOutlet ? `Outlet: ${w.posOutlet.name}` : 'Main warehouse' }))}
                required
              />
              <ComboBox
                label={isFnbMgr ? 'To outlet' : 'To warehouse / outlet'}
                placeholder={isFnbMgr ? 'Choose your outlet…' : 'Choose destination…'}
                value={toWarehouseId}
                onChange={setTo}
                options={destWarehouses.map(w => ({ value: w.id, label: w.posOutlet ? w.posOutlet.name : w.name, sub: w.posOutlet ? 'Outlet warehouse' : 'Main warehouse' }))}
                required
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Notes / reason</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Optional reason or transfer note…"
                className="w-full resize-none rounded-xl border border-white/10 bg-[#0d1832] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 transition-all focus:border-emerald-400/60 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.10)]" />
            </div>

            {/* Flow B toggle — Stock Manager only */}
            {isStockStaff && (
              <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3">
                <button type="button" onClick={() => setSelfIssue(v => !v)}
                  className={['relative h-5 w-9 rounded-full transition-colors', selfIssue ? 'bg-emerald-500' : 'bg-white/10'].join(' ')}>
                  <span className={['absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform', selfIssue ? 'translate-x-4' : 'translate-x-0.5'].join(' ')} />
                </button>
                <div>
                  <p className="text-sm font-semibold text-slate-200">{selfIssue ? 'Direct issue (Flow B)' : 'Create request (Flow A)'}</p>
                  <p className="text-[11px] text-slate-500">
                    {selfIssue
                      ? 'Stock will be deducted and marked as issued. Top management will confirm receipt.'
                      : 'Transfer will be created in PENDING_APPROVAL for standard review.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* line items */}
          <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Items to transfer</p>
                <p className="mt-1 text-xs text-slate-500">Add all stock items for this transfer.</p>
              </div>
              <button type="button" onClick={addLine} className="flex items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/20 transition-colors">
                <Plus className="h-3.5 w-3.5" /> Add item
              </button>
            </div>

            <div className="space-y-2.5">
              {lines.map((line, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center rounded-xl border border-white/[0.07] bg-[#0d1832] p-3">
                  {/* item combobox-lite via select (inline for grid layout) */}
                  <div className="col-span-5">
                    <select value={line.stockItemId}
                      onChange={e => {
                        const sel = fromItems.find(item => item.id === e.target.value);
                        setLines(cur => cur.map((ln, idx) => idx === i ? { ...ln, stockItemId: e.target.value, unitOfMeasure: sel?.baseUnit || ln.unitOfMeasure } : ln));
                      }}
                      required
                      className="h-10 w-full rounded-lg border border-white/10 bg-[#08111f] px-2.5 text-sm text-slate-200 outline-none focus:border-emerald-400/60">
                      <option value="">Select item…</option>
                      {fromItems.map(item => (
                        <option key={item.id} value={item.id}>{item.name} · {Number(item.quantityOnHand).toFixed(2)} {formatUnit(item.baseUnit)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input type="number" step="0.001" min="0.001" value={line.quantity}
                      onChange={e => updateLine(i, 'quantity', e.target.value)} required placeholder="Qty"
                      className="h-10 w-full rounded-lg border border-white/10 bg-[#08111f] px-2.5 text-sm text-white outline-none focus:border-emerald-400/60" />
                  </div>
                  <div className="col-span-2">
                    <select value={line.unitOfMeasure} onChange={e => updateLine(i, 'unitOfMeasure', e.target.value)}
                      className="h-10 w-full rounded-lg border border-white/10 bg-[#08111f] px-2.5 text-sm text-slate-200 outline-none focus:border-emerald-400/60">
                      {unitsForItem(line.stockItemId).map(u => <option key={u} value={u}>{formatUnit(u)}</option>)}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input type="text" value={line.notes} onChange={e => updateLine(i, 'notes', e.target.value)} placeholder="Notes…"
                      className="h-10 w-full rounded-lg border border-white/10 bg-[#08111f] px-2.5 text-sm text-slate-300 outline-none focus:border-emerald-400/60" />
                  </div>
                  <div className="col-span-1 flex justify-center">
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

          {/* submit */}
          <div className="flex items-center justify-between rounded-2xl border border-white/[0.08] bg-[#111c2e] px-5 py-4">
            <button type="button" onClick={() => router.back()} className="text-sm text-slate-500 hover:text-slate-300 transition-colors">← Cancel</button>
            <button type="submit" disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 transition-colors">
              {submitLabel()}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
