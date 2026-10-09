'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, ArrowRight, PackagePlus, ShoppingCart, Info, Search, X, ChevronDown, CheckCircle2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { INVENTORY_UNITS, formatUnit } from '@/lib/inventory/units';

interface ComboBoxProps {
  label?: string;
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
    <div ref={ref} className="relative w-full">
      {label && <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">{label}{required && <span className="ml-0.5 text-emerald-400">*</span>}</p>}
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

      {open && (
        <div className="absolute z-50 mt-1.5 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0d1e35] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">
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
                  ].join(' ') + " text-left"}
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

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);

  const [poData, setPoData] = useState({
    supplierId: '',
    expectedDate: '',
    notes: '',
  });

  const [items, setItems] = useState([{ id: crypto.randomUUID(), stockItemId: '', description: '', quantity: 1, uom: '', unitPrice: 0 }]);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetch('/api/v1/inventory/suppliers').then(r => r.json()).then(r => setSuppliers(r.data || []));
    fetch('/api/v1/inventory/stock-items?isMainWarehouse=true&limit=1000').then(r => r.json()).then(r => setStockItems(r.data?.items || []));
  }, []);

  const total = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
  
  const selectedUnits = (stockItemId: string) => {
    const stockItem = stockItems.find((item) => item.id === stockItemId);
    if (!stockItem) return INVENTORY_UNITS;
    return [stockItem.baseUnit, ...(stockItem.stockUnits || []).map((unit: any) => unit.unit).filter((unit: string) => unit !== stockItem.baseUnit)];
  };

  const supplierOptions = suppliers.map(s => ({ value: s.id, label: s.name }));
  const stockItemOptions = stockItems.map(si => ({
    value: si.id,
    label: si.name,
    sub: [si.sku, `Base: ${formatUnit(si.baseUnit)}`].filter(Boolean).join(' · '),
  }));

  async function handleSubmit() {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...poData, items: items.map(i => ({ stockItemId: i.stockItemId, description: i.description, quantity: i.quantity, uom: i.uom, unitPrice: i.unitPrice })) })
      });
      if (res.ok) {
        const { data } = await res.json();
        const id = data?.id;
        if (!id) throw new Error('PO was saved without an id');
        router.push(`/inventory/purchase-orders/${id}`);
      } else {
        const body = await res.json().catch(() => null);
        alert(body?.error || 'Failed to create PO');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const money = (v: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(v);

  return (
    <div className="min-h-full bg-[#08111f] text-slate-100 pb-16">
      {/* ── header ──────────────────────────────────────────────────── */}
      <section className="border-b border-white/[0.07] bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.14),_transparent_36%),linear-gradient(135deg,#0b1728,#08111f)] px-5 py-8 sm:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <Link href="/inventory/purchase-orders" className="mb-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Purchase Orders
              </Link>
              <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                <ShoppingCart className="h-4 w-4" /> Procurement
              </div>
              <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">New Purchase Order</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                Draft a new commitment to a supplier. Orders will remain in a draft state until submitted for approval.
              </p>
            </div>
            
            {/* Steps Progress */}
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#0d1832] p-2 text-sm font-medium">
               <button onClick={() => setStep(1)} className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${step === 1 ? 'bg-white/[0.06] text-white' : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'}`}>
                 <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${step === 1 ? 'bg-emerald-500 text-white' : 'bg-slate-800'}`}>1</span>
                 Details
               </button>
               <ArrowRight className="h-4 w-4 text-slate-600" />
               <button onClick={() => setStep(2)} disabled={!poData.supplierId} className={`flex items-center gap-2 rounded-lg px-4 py-2 transition-colors ${step === 2 ? 'bg-white/[0.06] text-white' : 'text-slate-500 hover:bg-white/[0.03] hover:text-slate-300'} disabled:opacity-50 disabled:cursor-not-allowed`}>
                 <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${step === 2 ? 'bg-emerald-500 text-white' : 'bg-slate-800'}`}>2</span>
                 Line Items
               </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── main ────────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-[1500px] mt-8 px-5 sm:px-8">
        <div className="mx-auto max-w-3xl">
          {step === 1 ? (
            <div className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-6 sm:p-8 shadow-2xl">
              <h2 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Info className="h-5 w-5 text-emerald-400" /> Order Details
              </h2>
              
              <div className="space-y-6">
                <div>
                  <ComboBox
                    label="Supplier"
                    placeholder="Select a supplier…"
                    value={poData.supplierId}
                    onChange={v => setPoData({ ...poData, supplierId: v })}
                    options={supplierOptions}
                    required
                  />
                </div>
                
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={poData.expectedDate}
                    onChange={e => setPoData({ ...poData, expectedDate: e.target.value })}
                    className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/60 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.10)] transition-all"
                  />
                </div>
                
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                    Internal Notes
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Add any specific instructions or references…"
                    value={poData.notes}
                    onChange={e => setPoData({ ...poData, notes: e.target.value })}
                    className="w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/60 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.10)] transition-all resize-none"
                  />
                </div>

                <div className="pt-6 border-t border-white/[0.07] flex justify-end">
                  <button
                    disabled={!poData.supplierId}
                    onClick={() => setStep(2)}
                    className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue to Line Items <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Items List */}
              <div className="space-y-4">
                {items.map((item, idx) => (
                  <div key={item.id} className="rounded-2xl border border-white/[0.08] bg-[#111c2e] p-6 shadow-xl relative group">
                    <button
                      onClick={() => setItems(items.filter((_, i) => i !== idx))}
                      className="absolute right-4 top-4 p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Remove line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    
                    <div className="pr-8 grid gap-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <ComboBox
                          label="Stock Item"
                          placeholder="Select item…"
                          value={item.stockItemId}
                          onChange={v => {
                            const newItems = [...items];
                            newItems[idx].stockItemId = v;
                            const selected = stockItems.find((si) => si.id === v);
                            newItems[idx].uom = selected?.baseUnit || '';
                            setItems(newItems);
                          }}
                          options={stockItemOptions}
                          required
                        />
                        
                        <div>
                          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            Description (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="Supplier specific code or note"
                            value={item.description}
                            onChange={e => {
                              const newItems = [...items];
                              newItems[idx].description = e.target.value;
                              setItems(newItems);
                            }}
                            className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/60 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.10)] transition-all"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            Quantity
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={e => {
                              const newItems = [...items];
                              newItems[idx].quantity = Number(e.target.value);
                              setItems(newItems);
                            }}
                            className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/60 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.10)] transition-all"
                          />
                        </div>
                        
                        <ComboBox
                          label="Unit of Measure"
                          placeholder="Select unit…"
                          value={item.uom}
                          onChange={v => {
                            const newItems = [...items];
                            newItems[idx].uom = v;
                            setItems(newItems);
                          }}
                          options={selectedUnits(item.stockItemId).map(u => ({ value: u, label: formatUnit(u) }))}
                          required
                        />
                        
                        <div>
                          <label className="mb-2 block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                            Unit Price (₦)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.unitPrice}
                            onChange={e => {
                              const newItems = [...items];
                              newItems[idx].unitPrice = Number(e.target.value);
                              setItems(newItems);
                            }}
                            className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/60 focus:shadow-[0_0_0_3px_rgba(52,211,153,0.10)] transition-all"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Line Item Button */}
              <button
                onClick={() => setItems([...items, { id: crypto.randomUUID(), stockItemId: '', description: '', quantity: 1, uom: '', unitPrice: 0 }])}
                className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.02] p-4 text-sm font-semibold text-emerald-400 hover:bg-white/[0.04] hover:border-emerald-400/50 transition-all"
              >
                <Plus className="h-4 w-4" /> Add another line item
              </button>

              {/* Summary & Actions */}
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] p-6 mt-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
                <div>
                  <p className="text-sm font-medium text-emerald-200">Total Purchase Value</p>
                  <p className="text-3xl font-bold text-white mt-1">{money(total)}</p>
                </div>
                
                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => setStep(1)}
                    className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/[0.04] transition-colors"
                  >
                    Back to Details
                  </button>
                  <button
                    disabled={loading || items.length === 0 || !items.every(i => i.stockItemId && i.uom)}
                    onClick={() => setShowPreview(true)}
                    className="flex-1 sm:flex-none flex justify-center items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-8 py-2.5 rounded-xl transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(52,211,153,0.2)]"
                  >
                    Preview PO <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ── preview modal ────────────────────────────────────────────────── */}
      {showPreview && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 bg-[#08111f]/80 backdrop-blur-sm">
          <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-white/10 bg-[#0d1832] shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-4 bg-[#111c2e]">
              <div>
                <h3 className="text-lg font-semibold text-white">Purchase Order Preview</h3>
                <p className="text-sm text-slate-400 mt-0.5">Please review the details before saving.</p>
              </div>
              <button onClick={() => setShowPreview(false)} className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-white/[0.05] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-2 gap-6 p-5 rounded-xl bg-white/[0.02] border border-white/[0.05]">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1">Supplier</p>
                  <p className="text-sm font-medium text-slate-200">{suppliers.find(s => s.id === poData.supplierId)?.name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1">Expected Delivery</p>
                  <p className="text-sm font-medium text-slate-200">{poData.expectedDate ? new Date(poData.expectedDate).toLocaleDateString() : 'N/A'}</p>
                </div>
                {poData.notes && (
                  <div className="col-span-2">
                    <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500 mb-1">Notes</p>
                    <p className="text-sm text-slate-300">{poData.notes}</p>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-200 mb-4 border-b border-white/10 pb-2">Line Items</h4>
                <div className="space-y-3">
                  {items.map((item, idx) => {
                    const stockItem = stockItems.find(si => si.id === item.stockItemId);
                    const lineTotal = item.quantity * item.unitPrice;
                    return (
                      <div key={item.id} className="flex justify-between items-center p-3 rounded-lg bg-white/[0.02] border border-white/[0.03]">
                        <div>
                          <p className="text-sm font-medium text-slate-200">{stockItem?.name || 'Unknown Item'}</p>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {item.quantity} {formatUnit(item.uom)} @ {money(item.unitPrice)}
                          </p>
                        </div>
                        <div className="text-sm font-semibold text-emerald-300">
                          {money(lineTotal)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-white/10 px-6 py-4 bg-[#111c2e]">
              <div>
                <p className="text-xs text-slate-400">Total Purchase Value</p>
                <p className="text-xl font-bold text-white">{money(total)}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPreview(false)}
                  className="px-5 py-2 rounded-xl border border-white/10 text-sm font-medium text-slate-300 hover:bg-white/[0.04] transition-colors"
                >
                  Cancel
                </button>
                <button
                  disabled={loading}
                  onClick={handleSubmit}
                  className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-6 py-2 rounded-xl transition-colors text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : <>Confirm & Save PO <CheckCircle2 className="h-4 w-4" /></>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
