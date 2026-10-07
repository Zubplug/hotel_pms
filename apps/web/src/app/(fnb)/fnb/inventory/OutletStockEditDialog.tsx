'use client';

import { useEffect, useState } from 'react';
import { Edit2, Loader2, X } from 'lucide-react';
import { formatUnit } from '@/lib/inventory/units';

type Props = { stockItemId: string; warehouseName: string; mainStock: { baseUnit: string; costPrice: number; purchaseUnit: string; unitsInBase: number } | null; onSaved: () => void };

export function OutletStockEditDialog({ stockItemId, warehouseName, mainStock, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [item, setItem] = useState<any>(null);
  const [quantity, setQuantity] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState('');
  const [unitsInBase, setUnitsInBase] = useState('1');
  const [cost, setCost] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function openEditor() {
    setOpen(true); setLoading(true); setError('');
    try {
      const response = await fetch(`/api/v1/inventory/stock-items/${stockItemId}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not load outlet stock');
      const next = body.data;
      if (!mainStock) throw new Error('This outlet item is not linked to a main stock-manager item');
      setItem(next);
      setPurchaseUnit(mainStock.purchaseUnit);
      setUnitsInBase(String(mainStock.unitsInBase));
      setQuantity(String(Number(next.quantityOnHand) / Number(mainStock.unitsInBase || 1)));
      setCost(String(mainStock.costPrice * Number(mainStock.unitsInBase || 1)));
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load outlet stock'); }
    finally { setLoading(false); }
  }

  async function save() {
    if (!item) return;
    const conversion = Number(mainStock?.unitsInBase || 0);
    const baseQuantity = Number(quantity) * conversion;
    if (!Number.isFinite(baseQuantity) || baseQuantity < 0 || conversion <= 0) return;
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/v1/inventory/stock-items/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ quantityOnHand: baseQuantity, outletStockOnly: true }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || 'Could not save outlet stock');
      setOpen(false); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save outlet stock'); }
    finally { setSaving(false); }
  }

  const conversion = mainStock ? Number(mainStock.unitsInBase || 1) : 0;
  return <>
    <button type="button" onClick={() => void openEditor()} className="inline-flex items-center gap-1.5 rounded-lg border border-orange-200 bg-orange-50 px-2.5 py-1.5 text-xs font-semibold text-orange-700 hover:bg-orange-100"><Edit2 className="h-3.5 w-3.5" /> Edit stock</button>
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center p-4"><div className="absolute inset-0 bg-black/50" onClick={() => !saving && setOpen(false)} /><div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[#eadfd8] bg-white text-[#24130d] shadow-2xl"><div className="flex items-start justify-between border-b border-[#f0e6e0] px-6 py-5"><div><p className="text-[11px] font-bold uppercase tracking-[0.15em] text-orange-700">Edit outlet stock</p><h2 className="mt-1 text-lg font-bold">{item?.name || 'Loading stock…'}</h2><p className="mt-0.5 text-xs text-[#927b70]">{warehouseName} · quantity-only outlet edit</p></div><button type="button" onClick={() => !saving && setOpen(false)}><X className="h-5 w-5 text-[#927b70]" /></button></div>{loading ? <div className="flex justify-center p-10"><Loader2 className="h-6 w-6 animate-spin text-orange-600" /></div> : <div className="space-y-4 p-6">{error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}<div className="rounded-xl bg-[#fff8f2] p-3 text-xs text-[#6f5d53]">Stock-manager setup: <strong>{formatUnit(purchaseUnit)}</strong> · {unitsInBase} {formatUnit(mainStock?.baseUnit || '')} per unit · <strong>₦{Number(cost).toLocaleString()}</strong> / purchase unit</div><div className="grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-[#6f5d53]">Quantity*<input type="number" min="0" step="0.0001" value={quantity} onChange={event => setQuantity(event.target.value)} className="mt-1.5 h-10 w-full rounded-lg border border-[#eadfd8] px-3 text-sm" /></label><label className="text-xs font-semibold text-[#6f5d53]">Purchase unit*<input readOnly value={formatUnit(purchaseUnit)} className="mt-1.5 h-10 w-full rounded-lg border border-[#eadfd8] bg-slate-100 px-3 text-sm text-slate-600" /></label><label className="text-xs font-semibold text-[#6f5d53]">Units in base<input readOnly value={unitsInBase} className="mt-1.5 h-10 w-full rounded-lg border border-[#eadfd8] bg-slate-100 px-3 text-sm text-slate-600" /></label><label className="text-xs font-semibold text-[#6f5d53]">Cost / unit*<input readOnly value={cost} className="mt-1.5 h-10 w-full rounded-lg border border-[#eadfd8] bg-slate-100 px-3 text-sm text-slate-600" /></label></div><p className="text-xs text-[#927b70]">Purchase unit, conversion, and cost are controlled by the main stock manager. Only this outlet quantity can be changed.</p><div className="flex justify-end gap-2 border-t border-[#f0e6e0] pt-4"><button type="button" onClick={() => setOpen(false)} disabled={saving} className="rounded-lg border border-[#eadfd8] px-4 py-2 text-sm font-semibold text-[#6f5d53]">Cancel</button><button type="button" onClick={() => void save()} disabled={saving || !item || !Number.isFinite(Number(quantity)) || Number(quantity) < 0 || conversion <= 0} className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Save outlet quantity</button></div></div>}</div></div>}
  </>;
}
