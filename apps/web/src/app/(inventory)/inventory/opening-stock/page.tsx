'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, PackagePlus } from 'lucide-react';
import { INVENTORY_UNITS, formatUnit } from '@/lib/inventory/units';

type Unit = { unit: string; unitsInBase: number | string; isPurchaseUnit?: boolean };
type Item = { id: string; name: string; sku?: string | null; baseUnit: string; quantityOnHand: number | string; costPrice: number | string; stockUnits?: Unit[] };
type Warehouse = { id: string; name: string; stockItems: Item[] };

export default function OpeningStockPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState('');
  const [stockItemId, setStockItemId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitCost, setUnitCost] = useState('');
  const [inputUnit, setInputUnit] = useState('');
  const [unitsInBase, setUnitsInBase] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok?: string; error?: string }>({});

  useEffect(() => {
    fetch('/api/v1/inventory/opening-stock')
      .then(async (res) => { const json = await res.json(); if (!res.ok) throw new Error(json.error || 'Unable to load warehouses'); return json.data || []; })
      .then((data) => { setWarehouses(data); if (data[0]) setWarehouseId(data[0].id); })
      .catch((error) => setMessage({ error: error.message }))
      .finally(() => setLoading(false));
  }, []);

  const warehouse = warehouses.find((item) => item.id === warehouseId);
  const item = warehouse?.stockItems.find((stock) => stock.id === stockItemId);
  const items = warehouse?.stockItems || [];
  const nextQty = Number(quantity || 0);
  const nextCost = Number(unitCost || 0);
  const unitOptions = item ? [{ unit: item.baseUnit, unitsInBase: 1 }, ...INVENTORY_UNITS.filter((unit) => unit !== item.baseUnit).map((unit) => ({
    unit,
    unitsInBase: item.stockUnits?.find((configured) => configured.unit === unit)?.unitsInBase || '',
  }))] : [];
  const selectedConversion = inputUnit === item?.baseUnit ? 1 : Number(unitsInBase || 0);
  const baseQuantity = nextQty * selectedConversion;
  const baseUnitCost = selectedConversion > 0 ? nextCost / selectedConversion : 0;
  const total = useMemo(() => nextQty * nextCost, [nextQty, nextCost]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!warehouse || !item || !inputUnit || selectedConversion <= 0 || nextQty <= 0 || nextCost < 0) return;
    setSaving(true); setMessage({});
    try {
      const res = await fetch('/api/v1/inventory/opening-stock', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouseId, stockItemId, quantity: nextQty, inputUnit, unitsInBase: selectedConversion, unitCost: nextCost, notes, operationId: crypto.randomUUID() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error || 'Opening stock could not be posted');
      setMessage({ ok: `${item.name}: ${baseQuantity} ${item.baseUnit} added to ${warehouse.name}.` });
      setQuantity(''); setUnitCost(''); setNotes('');
      setWarehouses((current) => current.map((store) => store.id !== warehouseId ? store : ({ ...store, stockItems: store.stockItems.map((stock) => stock.id !== stockItemId ? stock : { ...stock, quantityOnHand: Number(stock.quantityOnHand) + baseQuantity, costPrice: baseUnitCost }) })));
    } catch (error: any) { setMessage({ error: error.message }); }
    finally { setSaving(false); }
  }

  return <div className="min-h-full bg-slate-50">
    <div className="bg-gradient-to-r from-[#0b1120] to-[#0f2619] px-8 py-7 text-white">
      <div className="flex items-center gap-3"><PackagePlus className="h-7 w-7 text-emerald-400" /><div><h1 className="text-2xl font-bold">Legacy Opening Stock</h1><p className="mt-1 text-sm text-slate-400">Add verified old stock to the property main warehouse.</p></div></div>
    </div>
    <div className="mx-auto max-w-2xl space-y-5 px-6 py-7">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"><strong>Temporary controlled workflow.</strong> This increases only main-warehouse stock and records an auditable OPENING_BALANCE transaction. It does not add stock to outlets.</div>
      {message.ok && <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700"><CheckCircle className="h-5 w-5" />{message.ok}</div>}
      {message.error && <div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="h-5 w-5" />{message.error}</div>}
      <form onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin text-emerald-600" /></div> : <>
          <label className="block text-sm font-semibold text-slate-700">Main warehouse<select value={warehouseId} onChange={(e) => { setWarehouseId(e.target.value); setStockItemId(''); setInputUnit(''); setUnitsInBase(''); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" required>{warehouses.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>
          <label className="block text-sm font-semibold text-slate-700">Stock item<select value={stockItemId} onChange={(e) => { setStockItemId(e.target.value); const selected = items.find((stock) => stock.id === e.target.value); const purchaseUnit = selected?.stockUnits?.find((unit) => unit.isPurchaseUnit); const nextUnit = purchaseUnit?.unit || selected?.baseUnit || ''; setInputUnit(nextUnit); setUnitsInBase(nextUnit === selected?.baseUnit ? '1' : String(purchaseUnit?.unitsInBase || '')); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5" required><option value="">Choose an item…</option>{items.map((stock) => <option key={stock.id} value={stock.id}>{stock.name}{stock.sku ? ` (${stock.sku})` : ''} · Current {Number(stock.quantityOnHand).toFixed(2)} {formatUnit(stock.baseUnit)}</option>)}</select></label>
          <div className="grid gap-4 sm:grid-cols-4"><label className="block text-sm font-semibold text-slate-700">Purchase quantity<input type="number" min="0.0001" step="0.0001" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" required /></label><label className="block text-sm font-semibold text-slate-700">Purchase unit<select value={inputUnit} onChange={(e) => { const nextUnit = e.target.value; setInputUnit(nextUnit); setUnitsInBase(nextUnit === item?.baseUnit ? '1' : String(item?.stockUnits?.find((unit) => unit.unit === nextUnit)?.unitsInBase || '')); }} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" required disabled={!item}><option value="">Choose unit…</option>{unitOptions.map((unit) => <option key={unit.unit} value={unit.unit}>{formatUnit(unit.unit)}{Number(unit.unitsInBase) > 1 ? ` · ${unit.unitsInBase} ${formatUnit(item?.baseUnit || '')}` : ''}</option>)}</select></label><label className="block text-sm font-semibold text-slate-700">Units in base<input type="number" min="0.000001" step="0.000001" value={unitsInBase} onChange={(e) => setUnitsInBase(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" required disabled={!item || inputUnit === item.baseUnit} placeholder={`1 ${formatUnit(item?.baseUnit || '')}`} /></label><label className="block text-sm font-semibold text-slate-700">Cost per purchase unit (₦)<input type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2.5" required /></label></div>
          {item && selectedConversion > 0 && <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">This will add <strong>{baseQuantity.toFixed(2)} {item.baseUnit}</strong> at <strong>₦{baseUnitCost.toFixed(2)} per {item.baseUnit}</strong>.</div>}
          <label className="block text-sm font-semibold text-slate-700">Reason / note<textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Opening stock count from legacy system" className="mt-1.5 min-h-24 w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <div className="flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-sm text-slate-500">Opening value <strong className="text-slate-800">₦{total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</strong></span><button disabled={saving || !item || nextQty <= 0} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Posting…' : 'Add Opening Stock'}</button></div>
        </>}
      </form>
    </div>
  </div>;
}
