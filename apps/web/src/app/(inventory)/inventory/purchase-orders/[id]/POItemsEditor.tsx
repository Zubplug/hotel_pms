'use client';

import { useState } from 'react';
import { Trash2, Save, X } from 'lucide-react';
import { INVENTORY_UNITS, formatUnit } from '@/lib/inventory/units';

type Item = {
  id: string;
  description: string;
  quantity: number | string;
  unitOfMeasure: string;
  unitPrice: number | string;
  totalPrice: number | string;
  receivedQty: number | string;
  stockItemName: string;
  stockType: string;
  conversionToBase: number;
  stockBaseUnit: string;
};

export function POItemsEditor({ poId, items, editable, currency }: { poId: string; items: Item[]; editable: boolean; currency: string }) {
  const [rows, setRows] = useState(items.map(item => ({ ...item })));
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const total = rows.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);

  const update = (id: string, field: keyof Item, value: string) => setRows(current => current.map(item => item.id === id ? { ...item, [field]: value } : item));
  const remove = (id: string) => setRows(current => current.filter(item => item.id !== id));
  const cancel = () => { setRows(items.map(item => ({ ...item }))); setError(''); setEditing(false); };

  async function save() {
    setSaving(true); setError('');
    try {
      const res = await fetch(`/api/v1/inventory/purchase-orders/${poId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: rows.map(item => ({ id: item.id, description: item.description, quantity: Number(item.quantity), unitOfMeasure: item.unitOfMeasure, unitPrice: Number(item.unitPrice) })) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Failed to save PO adjustments');
      setEditing(false); window.location.reload();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  }

  return <div className="overflow-hidden rounded-2xl border border-white/[.08] bg-[#111c2e]">
    <div className="flex items-center justify-between border-b border-white/[.07] px-5 py-5 sm:px-6">
      <div><h2 className="text-sm font-semibold text-white">Line items</h2><p className="mt-1 text-xs text-slate-500">Requested quantities, pricing, and receiving progress.</p></div>
      {editable && !editing && <button onClick={() => setEditing(true)} className="rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20">Adjust items</button>}
      {editing && <div className="flex gap-2"><button onClick={cancel} disabled={saving} className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300"><X className="h-3 w-3" />Cancel</button><button onClick={save} disabled={saving || rows.length === 0} className="inline-flex items-center gap-1 rounded-lg bg-emerald-400 px-3 py-2 text-xs font-semibold text-[#07111f] disabled:opacity-50"><Save className="h-3 w-3" />{saving ? 'Saving...' : 'Save changes'}</button></div>}
    </div>
    {error && <p className="mx-5 mt-4 rounded-lg border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200 sm:mx-6">{error}</p>}
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] whitespace-nowrap text-left text-sm"><thead className="border-b border-white/[.07] bg-white/[.025] text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="px-5 py-3 font-semibold sm:px-6">Item</th><th className="px-5 py-3 text-right font-semibold sm:px-6">Qty</th><th className="px-5 py-3 font-semibold sm:px-6">Unit</th><th className="px-5 py-3 text-right font-semibold sm:px-6">Unit price</th><th className="px-5 py-3 text-right font-semibold sm:px-6">Total</th><th className="px-5 py-3 sm:px-6" /></tr></thead><tbody className="divide-y divide-white/[.06]">
      {rows.map(item => <tr key={item.id} className="transition hover:bg-white/[.02]"><td className="px-5 py-4 sm:px-6">{editing ? <input value={item.description} onChange={e => update(item.id, 'description', e.target.value)} className="field min-w-48" /> : <><span className="font-medium text-slate-200">{item.stockItemName}</span><span className="mt-1 block text-xs capitalize text-slate-500">{item.stockType.replace('_', ' ').toLowerCase()}{item.description ? ` · ${item.description}` : ''}</span></>}</td><td className="px-5 py-4 text-right text-slate-300 sm:px-6">{editing ? <input type="number" min="0.0001" step="0.0001" value={item.quantity} onChange={e => update(item.id, 'quantity', e.target.value)} className="field w-24 text-right" /> : Number(item.quantity).toFixed(2)}</td><td className="px-5 py-4 text-slate-300 sm:px-6">{editing ? <select value={item.unitOfMeasure} onChange={e => update(item.id, 'unitOfMeasure', e.target.value)} className="field w-auto">{INVENTORY_UNITS.map(unit => <option key={unit} value={unit}>{formatUnit(unit)}</option>)}</select> : <>{item.unitOfMeasure}{item.conversionToBase !== 1 && <span className="mt-1 block text-xs text-slate-500">× {item.conversionToBase} {item.stockBaseUnit}</span>}</>}</td><td className="px-5 py-4 text-right text-slate-300 sm:px-6">{editing ? <input type="number" min="0" step="0.01" value={item.unitPrice} onChange={e => update(item.id, 'unitPrice', e.target.value)} className="field w-28 text-right" /> : `${currency} ${Number(item.unitPrice).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</td><td className="px-5 py-4 text-right font-semibold text-white sm:px-6">{currency} {(Number(item.quantity) * Number(item.unitPrice)).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td className="px-5 py-4 text-right sm:px-6">{editing && <button onClick={() => remove(item.id)} title="Remove item" className="rounded-lg p-1.5 text-rose-300 transition hover:bg-rose-400/10"><Trash2 className="h-4 w-4" /></button>}</td></tr>)}
    </tbody><tfoot className="border-t border-white/[.07] bg-white/[.025]"><tr><td colSpan={4} className="px-5 py-4 text-right font-semibold text-slate-500 sm:px-6">Order total</td><td className="px-5 py-4 text-right font-bold text-white sm:px-6">{currency} {total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td><td /></tr></tfoot></table></div>
  </div>;
}
