'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, ArrowRight, Boxes, CheckCircle2, ChevronDown,
  ClipboardCheck, Edit2, Info, Loader2, PackagePlus, RefreshCw,
  Save, Search, ShieldCheck, Trash2, Warehouse, X,
} from 'lucide-react';
import Link from 'next/link';
import { INVENTORY_UNITS, formatUnit } from '@/lib/inventory/units';

/* ─── types ─────────────────────────────────────────────────────────────── */
type Unit      = { unit: string; unitsInBase: number | string; isPurchaseUnit?: boolean };
type Item      = { id: string; name: string; sku?: string | null; baseUnit: string; quantityOnHand: number | string; costPrice: number | string; stockUnits?: Unit[] };
type WarehouseT = { id: string; name: string; stockItems: Item[] };
type Pending   = { id: string; warehouse: WarehouseT; item: Item; inputUnit: string; quantity: number; unitsInBase: number; unitCost: number; notes: string; baseQty: number; total: number };

const money = (v: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(v);

/* ─── custom combobox ────────────────────────────────────────────────────── */
interface ComboBoxProps {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; sub?: string }[];
  disabled?: boolean;
  required?: boolean;
}

function ComboBox({ label, placeholder, value, onChange, options, disabled, required }: ComboBoxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = options.filter(o =>
    o.label.toLowerCase().includes(search.toLowerCase()) ||
    (o.sub && o.sub.toLowerCase().includes(search.toLowerCase()))
  );

  const selected = options.find(o => o.value === value);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 30);
  };

  return (
    <div ref={ref} className="relative">
      {label && <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}{required && <span className="ml-0.5 text-emerald-400">*</span>}</p>}
      {/* trigger */}
      <button
        type="button"
        onClick={handleOpen}
        disabled={disabled}
        className={[
          'flex h-11 w-full items-center justify-between gap-2 rounded-xl border px-3.5 text-sm transition-all',
          open
            ? 'border-emerald-400/60 bg-[#0d1e35] shadow-[0_0_0_3px_rgba(52,211,153,0.10)]'
            : 'border-white/10 bg-[#0d1832]',
          disabled ? 'cursor-not-allowed opacity-40' : 'hover:border-white/20 cursor-pointer',
        ].join(' ')}
      >
        <span className={selected ? 'text-slate-100 truncate' : 'text-slate-500 truncate'}>{selected?.label ?? placeholder}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* dropdown panel */}
      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d1e35] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
          {/* search */}
          <div className="flex items-center gap-2 border-b border-white/[0.07] px-3 py-2.5">
            <Search className="h-3.5 w-3.5 shrink-0 text-slate-500" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600 outline-none"
            />
            {search && (
              <button type="button" onClick={() => setSearch('')}>
                <X className="h-3.5 w-3.5 text-slate-500 hover:text-slate-300" />
              </button>
            )}
          </div>
          {/* list */}
          <ul className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-500">No results</li>
            ) : filtered.map(o => (
              <li key={o.value}>
                <button
                  type="button"
                  onClick={() => { onChange(o.value); setOpen(false); setSearch(''); }}
                  className={[
                    'flex w-full flex-col items-start px-4 py-2.5 text-left transition-colors hover:bg-white/[0.05]',
                    o.value === value ? 'bg-emerald-400/[0.08]' : '',
                  ].join(' ')}
                >
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

/* ─── edit pending modal ──────────────────────────────────────────────────── */
function EditPendingModal({
  p,
  onClose,
  onSave,
}: {
  p: Pending;
  onClose: () => void;
  onSave: (updated: Pending) => void;
}) {
  const [quantity, setQuantity]     = useState(String(p.quantity));
  const [inputUnit, setInputUnit]   = useState(p.inputUnit);
  const [unitsInBase, setUnitsInBase] = useState(String(p.unitsInBase));
  const [unitCost, setUnitCost]     = useState(String(p.unitCost));
  const [notes, setNotes]           = useState(p.notes);

  const unitOpts = [
    { value: p.item.baseUnit, label: formatUnit(p.item.baseUnit), sub: 'Base unit' },
    ...INVENTORY_UNITS
      .filter(u => u !== p.item.baseUnit)
      .map(u => {
        const conv = p.item.stockUnits?.find(c => c.unit === u);
        return {
          value: u,
          label: formatUnit(u),
          sub: conv ? `${conv.unitsInBase} ${formatUnit(p.item.baseUnit)}` : undefined,
        };
      }),
  ];

  const conversionNum  = inputUnit === p.item.baseUnit ? 1 : Number(unitsInBase || 0);
  const quantityNum    = Number(quantity || 0);
  const costNum        = Number(unitCost || 0);
  const baseQty        = quantityNum * conversionNum;
  const total          = quantityNum * costNum;
  const canSave        = quantityNum > 0 && costNum >= 0 && conversionNum > 0;

  function handleUnitChange(u: string) {
    setInputUnit(u);
    if (u === p.item.baseUnit) {
      setUnitsInBase('1');
    } else {
      const conv = p.item.stockUnits?.find(c => c.unit === u);
      setUnitsInBase(conv ? String(conv.unitsInBase) : '');
    }
  }

  function handleSave() {
    if (!canSave) return;
    onSave({
      ...p,
      quantity: quantityNum,
      inputUnit,
      unitsInBase: conversionNum,
      unitCost: costNum,
      notes,
      baseQty,
      total,
    });
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* panel */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/[0.1] bg-[#111c2e] shadow-[0_24px_80px_rgba(0,0,0,0.8)] overflow-hidden">

        {/* header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-cyan-400">Edit batch entry</p>
            <h2 className="mt-1 text-lg font-semibold text-white">{p.item.name}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{p.warehouse.name} · base unit: {formatUnit(p.item.baseUnit)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-white/[0.06] hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* body */}
        <div className="space-y-4 px-6 py-5">

          {/* quantity + unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Quantity<span className="text-cyan-400">*</span>
              </label>
              <input
                type="number" min="0.0001" step="0.0001"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.10)] transition-all"
                autoFocus
              />
            </div>

            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                Unit<span className="text-cyan-400">*</span>
              </label>
              <select
                value={inputUnit}
                onChange={e => handleUnitChange(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white outline-none focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.10)] transition-all"
              >
                {unitOpts.map(u => (
                  <option key={u.value} value={u.value}>{u.label}{u.sub ? ` (${u.sub})` : ''}</option>
                ))}
              </select>
            </div>
          </div>

          {/* units in base — only when not base unit */}
          {inputUnit !== p.item.baseUnit && (
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                {formatUnit(inputUnit)} → how many {formatUnit(p.item.baseUnit)}?
              </label>
              <input
                type="number" min="0.000001" step="0.000001"
                value={unitsInBase}
                onChange={e => setUnitsInBase(e.target.value)}
                placeholder="e.g. 24 for a crate of 24 bottles"
                className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.10)] transition-all"
              />
            </div>
          )}

          {/* cost */}
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Cost per {formatUnit(inputUnit)} (₦)<span className="text-cyan-400">*</span>
            </label>
            <input
              type="number" min="0" step="0.01"
              value={unitCost}
              onChange={e => setUnitCost(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.10)] transition-all"
            />
          </div>

          {/* notes */}
          <div>
            <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
              Reason / evidence
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. verified opening count from legacy system"
              rows={2}
              className="w-full resize-none rounded-xl border border-white/10 bg-[#0d1832] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/60 focus:shadow-[0_0_0_3px_rgba(34,211,238,0.10)] transition-all"
            />
          </div>

          {/* live preview */}
          {canSave && (
            <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[.05] px-4 py-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-cyan-200">Base qty after edit:</span>
                <strong className="text-white">{baseQty.toFixed(2)} {formatUnit(p.item.baseUnit)}</strong>
              </div>
              <div className="mt-1 flex items-center justify-between text-xs">
                <span className="text-cyan-200">Line value:</span>
                <strong className="text-emerald-300">{money(total)}</strong>
              </div>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between border-t border-white/[0.07] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-medium text-slate-400 hover:bg-white/[.04] hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
          >
            <Save className="h-4 w-4" />
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── pending row ─────────────────────────────────────────────────────────── */
function PendingRow({ p, onRemove, onEdit }: { p: Pending; onRemove: () => void; onEdit: () => void }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-white/[0.07] bg-[#0d1832] px-4 py-3 transition-all hover:border-white/[0.12]">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-100">{p.item.name}</span>
          {p.item.sku && <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-400">{p.item.sku}</span>}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          <span>{p.warehouse.name}</span>
          <span>·</span>
          <span className="text-cyan-300">{p.quantity} {formatUnit(p.inputUnit)} → {p.baseQty.toFixed(2)} {formatUnit(p.item.baseUnit)}</span>
          <span>·</span>
          <span className="text-emerald-300 font-medium">{money(p.total)}</span>
        </div>
        {p.notes && <p className="mt-1 text-[11px] text-slate-600 italic truncate">{p.notes}</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          type="button"
          onClick={onEdit}
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-cyan-500/10 hover:text-cyan-400"
          title="Edit this entry"
        >
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-rose-500/10 hover:text-rose-400"
          title="Remove this entry"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/* ─── main page ───────────────────────────────────────────────────────────── */
export default function OpeningStockPage() {
  const [warehouses, setWarehouses]   = useState<WarehouseT[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [stockItemId, setStockItemId] = useState('');
  const [quantity, setQuantity]       = useState('');
  const [unitCost, setUnitCost]       = useState('');
  const [inputUnit, setInputUnit]     = useState('');
  const [unitsInBase, setUnitsInBase] = useState('');
  const [notes, setNotes]             = useState('');
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(false);
  const [message, setMessage]         = useState<{ ok?: string; error?: string }>({});
  const [editingPending, setEditingPending] = useState<Pending | null>(null);
  const [pending, setPending]         = useState<Pending[]>([]);

  /* load */
  const load = async () => {
    setLoading(true);
    try {
      const r    = await fetch('/api/v1/inventory/opening-stock', { cache: 'no-store' });
      const body = await r.json();
      if (!r.ok) throw new Error(body.error || 'Unable to load warehouses');
      const data: WarehouseT[] = body.data || [];
      setWarehouses(data);
      if (data[0] && !warehouseId) setWarehouseId(data[0].id);
    } catch (e: any) { setMessage({ error: e.message }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  /* derived */
  const warehouse   = warehouses.find(w => w.id === warehouseId);
  const items       = warehouse?.stockItems || [];
  const item        = items.find(s => s.id === stockItemId);
  const quantityNum = Number(quantity || 0);
  const costNum     = Number(unitCost || 0);
  const unitOptions = item
    ? [
        { unit: item.baseUnit, unitsInBase: 1 },
        ...INVENTORY_UNITS.filter(u => u !== item.baseUnit).map(u => ({
          unit: u,
          unitsInBase: item.stockUnits?.find(c => c.unit === u)?.unitsInBase || '',
        })),
      ]
    : [];
  const selectedConversion = inputUnit === item?.baseUnit ? 1 : Number(unitsInBase || 0);
  const baseQuantity       = quantityNum * selectedConversion;
  const total              = useMemo(() => quantityNum * costNum, [quantityNum, costNum]);
  const itemCount          = warehouses.reduce((s, w) => s + w.stockItems.length, 0);
  const onHandValue        = warehouses.reduce((s, w) => s + w.stockItems.reduce((sub, st) => sub + Number(st.quantityOnHand) * Number(st.costPrice || 0), 0), 0);
  const pendingTotal       = pending.reduce((s, p) => s + p.total, 0);
  const canAdd             = !saving && !!warehouse && !!item && !!inputUnit && selectedConversion > 0 && quantityNum > 0 && costNum >= 0;

  /* combobox options */
  const warehouseOptions = warehouses.map(w => ({ value: w.id, label: w.name }));
  const itemOptions      = items.map(it => ({
    value: it.id,
    label: it.name,
    sub: [it.sku, `On-hand: ${Number(it.quantityOnHand).toFixed(2)} ${formatUnit(it.baseUnit)}`].filter(Boolean).join(' · '),
  }));
  const unitOpts = unitOptions.map(u => ({
    value: u.unit,
    label: formatUnit(u.unit),
    sub: Number(u.unitsInBase) > 1 ? `${u.unitsInBase} ${formatUnit(item?.baseUnit || '')}` : undefined,
  }));

  /* add to pending list */
  function addToPending() {
    if (!warehouse || !item || !inputUnit || selectedConversion <= 0 || quantityNum <= 0 || costNum < 0) return;
    const entry: Pending = {
      id: crypto.randomUUID(),
      warehouse, item, inputUnit,
      quantity: quantityNum,
      unitsInBase: selectedConversion,
      unitCost: costNum,
      notes,
      baseQty: baseQuantity,
      total,
    };
    setPending(prev => [...prev, entry]);
    setQuantity(''); setUnitCost(''); setNotes('');
    setMessage({});
  }

  /* edit pending item — open modal */
  function handleEditPending(p: Pending) {
    setEditingPending(p);
  }

  function handleSavePendingEdit(updated: Pending) {
    setPending(prev => prev.map(x => x.id === updated.id ? updated : x));
    setEditingPending(null);
  }

  /* post one */
  async function postOne(p: Pending): Promise<{ ok: boolean; msg: string }> {
    const r    = await fetch('/api/v1/inventory/opening-stock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        warehouseId: p.warehouse.id,
        stockItemId: p.item.id,
        quantity: p.quantity,
        inputUnit: p.inputUnit,
        unitsInBase: p.unitsInBase,
        overrideBaseUnit: true,
        unitCost: p.unitCost,
        notes: p.notes,
        operationId: crypto.randomUUID(),
      }),
    });
    const body = await r.json();
    if (!r.ok || body.error) return { ok: false, msg: body.error || 'Post failed' };
    return { ok: true, msg: `${p.item.name}: ${p.baseQty.toFixed(2)} ${formatUnit(p.item.baseUnit)} → ${p.warehouse.name}` };
  }

  /* submit all pending */
  async function submitAll(event: React.FormEvent) {
    event.preventDefault();
    if (pending.length === 0) return;
    setSaving(true); setMessage({});
    const results = await Promise.allSettled(pending.map(postOne));
    const errors: string[] = [];
    const successes: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        if (r.value.ok) successes.push(r.value.msg);
        else errors.push(`${pending[i].item.name}: ${r.value.msg}`);
      } else {
        errors.push(`${pending[i].item.name}: ${String(r.reason)}`);
      }
    });
    if (errors.length === 0) {
      setPending([]);
      setMessage({ ok: `${successes.length} item${successes.length > 1 ? 's' : ''} posted successfully.` });
    } else {
      setMessage({ error: `${errors.length} failed. ${errors.join('; ')}` });
    }
    await load();
    setSaving(false);
  }

  /* ── render ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-full bg-[#08111f] text-slate-100">
      {/* ── edit modal ───────────────────────────────────────────────── */}
      {editingPending && (
        <EditPendingModal
          p={editingPending}
          onClose={() => setEditingPending(null)}
          onSave={handleSavePendingEdit}
        />
      )}
      {/* ── header ──────────────────────────────────────────────────── */}
      <section className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.15),_transparent_34%),linear-gradient(135deg,#0b1728,#08111f)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-300">
                <PackagePlus className="h-4 w-4" /> Inventory foundation
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Opening stock</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Post verified legacy inventory into an active main warehouse with unit conversion, weighted cost, idempotency, and a traceable opening-balance transaction.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void load()}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[.04] px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/[.08] transition-colors"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              <Link
                href="/inventory/reconciliation"
                className="inline-flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/15 px-4 py-2.5 text-sm font-semibold text-amber-200 hover:bg-amber-400/25 transition-colors"
              >
                <ClipboardCheck className="h-4 w-4" /> Reconciliation
              </Link>
            </div>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />Controlled main-warehouse posting</span>
            <span>{warehouses.length} active main warehouse{warehouses.length === 1 ? '' : 's'}</span>
            <span>{itemCount} active stock items available</span>
          </div>
        </div>
      </section>

      {/* ── main ────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[1500px] space-y-6 px-5 py-6 sm:px-8">

        {/* kpi strip */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { label: 'Available warehouses', value: String(warehouses.length), sub: 'Outlet locations excluded by policy', icon: <Warehouse className="h-4 w-4" />, colour: 'text-cyan-300 bg-cyan-400/10' },
            { label: 'Current on-hand value', value: money(onHandValue), sub: 'Live quantity × current cost price', icon: <Boxes className="h-4 w-4" />, colour: 'text-violet-300 bg-violet-400/10' },
            { label: 'Posting class', value: 'OPENING_BALANCE', sub: 'Each post is idempotent and auditable', icon: <ShieldCheck className="h-4 w-4" />, colour: 'text-emerald-300 bg-emerald-400/10' },
          ].map(k => (
            <div key={k.label} className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5">
              <div className="flex items-start justify-between">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{k.label}</p>
                <div className={`rounded-xl p-2 ${k.colour}`}>{k.icon}</div>
              </div>
              <p className="mt-5 text-2xl font-semibold text-white">{k.value}</p>
              <p className="mt-1 text-xs text-slate-500">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* ── two-column layout ───────────────────────────────────── */}
        <div className="grid gap-6 xl:grid-cols-[.8fr_1.2fr]">

          {/* guardrails */}
          <section className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-400/10 p-2 text-emerald-300"><Info className="h-4 w-4" /></div>
              <div>
                <p className="text-sm font-semibold text-white">Posting guardrails</p>
                <p className="mt-1 text-xs text-slate-500">What this workflow controls</p>
              </div>
            </div>
            <div className="mt-5 space-y-3 text-sm leading-6 text-slate-400">
              <p>Only active main warehouses can receive opening stock.</p>
              <p>Quantity is converted to the item base unit before the stock transaction is recorded.</p>
              <p>The item cost is recalculated using the incoming opening value and existing on-hand value.</p>
              <p>Opening stock does not replace count reconciliation or outlet transfers.</p>
            </div>
            <Link href="/inventory/stock-items" className="mt-5 inline-flex items-center gap-1 text-xs font-semibold text-cyan-300 hover:text-cyan-200">
              Review stock master <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </section>

          {/* ── form + pending ───────────────────────────────────── */}
          <div className="space-y-4">

            {/* alerts */}
            {message.ok && (
              <div className="flex gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.08] p-3 text-sm text-emerald-200">
                <CheckCircle2 className="h-5 w-5 shrink-0" />{message.ok}
              </div>
            )}
            {message.error && (
              <div className="flex gap-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.08] p-3 text-sm text-rose-200">
                <AlertTriangle className="h-5 w-5 shrink-0" />{message.error}
              </div>
            )}

            {/* input card */}
            <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-sm font-semibold text-white">Add an item to the batch</p>
                  <p className="mt-1 text-xs text-slate-500">Use only for verified legacy or initial inventory balances.</p>
                </div>
                <PackagePlus className="h-4 w-4 text-slate-500" />
              </div>

              {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-7 w-7 animate-spin text-emerald-300" /></div>
              ) : (
                <div className="space-y-4">
                  {/* warehouse */}
                  <ComboBox
                    label="Main warehouse"
                    placeholder="Choose a warehouse…"
                    value={warehouseId}
                    onChange={v => { setWarehouseId(v); setStockItemId(''); setInputUnit(''); setUnitsInBase(''); }}
                    options={warehouseOptions}
                    required
                  />

                  {/* stock item */}
                  <div className="relative">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">Stock item<span className="ml-0.5 text-emerald-400">*</span></p>
                    </div>
                    <ComboBox
                      label=""
                      placeholder="Choose an item…"
                      value={stockItemId}
                      onChange={v => {
                        setStockItemId(v);
                        const sel = items.find(it => it.id === v);
                        const pu  = sel?.stockUnits?.find(u => u.isPurchaseUnit);
                        const next = pu?.unit || sel?.baseUnit || '';
                        setInputUnit(next);
                        setUnitsInBase(next === sel?.baseUnit ? '1' : String(pu?.unitsInBase || ''));
                      }}
                      options={itemOptions}
                      disabled={!warehouseId}
                    />
                  </div>

                  {/* quantity + unit + base + cost */}
                  <div className="grid gap-4 sm:grid-cols-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">
                        Quantity<span className="text-emerald-400">*</span>
                      </label>
                      <input
                        type="number" min="0.0001" step="0.0001"
                        value={quantity}
                        onChange={e => setQuantity(e.target.value)}
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 transition-all focus:border-emerald-400/60 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.10)]"
                        required
                      />
                    </div>

                    <ComboBox
                      label="Purchase unit"
                      placeholder="Unit…"
                      value={inputUnit}
                      onChange={v => {
                        setInputUnit(v);
                        setUnitsInBase(v === item?.baseUnit ? '1' : String(item?.stockUnits?.find(u => u.unit === v)?.unitsInBase || ''));
                      }}
                      options={unitOpts}
                      disabled={!item}
                      required
                    />

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">
                        Units in base
                      </label>
                      <input
                        type="number" min="0.000001" step="0.000001"
                        value={unitsInBase}
                        onChange={e => setUnitsInBase(e.target.value)}
                        disabled={!item || inputUnit === item?.baseUnit}
                        placeholder="1"
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 transition-all focus:border-emerald-400/60 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.10)] disabled:opacity-40 disabled:cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">
                        Cost / unit<span className="text-emerald-400">*</span>
                      </label>
                      <input
                        type="number" min="0" step="0.01"
                        value={unitCost}
                        onChange={e => setUnitCost(e.target.value)}
                        className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 transition-all focus:border-emerald-400/60 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.10)]"
                        required
                      />
                    </div>
                  </div>

                  {/* preview */}
                  {item && (
                    <div className="rounded-xl border border-cyan-400/15 bg-cyan-400/[.05] p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-cyan-200">Current on-hand in warehouse:</span>
                        <strong className="text-white">{Number(item.quantityOnHand).toFixed(2)} {formatUnit(item.baseUnit)}</strong>
                      </div>
                      {selectedConversion > 0 && quantityNum > 0 && (
                        <div className="border-t border-cyan-400/10 pt-2 text-xs leading-5 text-cyan-100">
                          Incoming: <strong>{baseQuantity.toFixed(2)} {formatUnit(item.baseUnit)}</strong> at <strong>{money(total)}</strong> value.<br/>
                          Total after posting: <strong>{(Number(item.quantityOnHand) + baseQuantity).toFixed(2)} {formatUnit(item.baseUnit)}</strong>
                        </div>
                      )}
                    </div>
                  )}

                  {/* notes */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400 mb-2">
                      Reason / evidence
                    </label>
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Example: verified opening count from legacy system"
                      className="min-h-20 w-full resize-none rounded-xl border border-white/10 bg-[#0d1832] px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 transition-all focus:border-emerald-400/60 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.10)]"
                    />
                  </div>

                  {/* add button */}
                  <div className="flex items-center justify-between border-t border-white/[.08] pt-4">
                    <span className="text-sm text-slate-500">
                      Line value <strong className="text-slate-200">{money(total)}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={addToPending}
                      disabled={!canAdd}
                      className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                    >
                      + Add to batch
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── pending batch ─────────────────────────────────── */}
            {pending.length > 0 && (
              <form onSubmit={submitAll} className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Pending batch
                      <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-300">
                        {pending.length}
                      </span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Review and remove entries before posting. Total: <strong className="text-slate-200">{money(pendingTotal)}</strong></p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPending([])}
                    className="text-xs text-slate-600 hover:text-rose-400 transition-colors"
                    title="Clear all"
                  >
                    Clear all
                  </button>
                </div>

                <div className="space-y-2.5">
                  {pending.map(p => (
                    <PendingRow key={p.id} p={p} onRemove={() => setPending(prev => prev.filter(x => x.id !== p.id))} onEdit={() => handleEditPending(p)} />
                  ))}
                </div>

                <div className="flex items-center justify-between border-t border-white/[.08] pt-4">
                  <span className="text-sm text-slate-500">
                    Batch total <strong className="text-slate-200">{money(pendingTotal)}</strong> · {pending.length} item{pending.length > 1 ? 's' : ''}
                  </span>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                  >
                    {saving ? (
                      <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Posting…</span>
                    ) : `Post ${pending.length} item${pending.length > 1 ? 's' : ''}`}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
