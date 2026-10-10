'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CheckCircle2, Edit3, Loader2, Package } from 'lucide-react';
import { INVENTORY_UNITS, roundCurrency } from '@/lib/inventory/units';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const STOCK_TYPES = [
  { value: 'SELLABLE', label: 'Sellable / Resale' },
  { value: 'RAW_MATERIAL', label: 'Raw Material / Production' },
  { value: 'CONSUMABLE', label: 'General Consumable' },
  { value: 'CLEANING', label: 'Cleaning' },
  { value: 'HOUSEKEEPING', label: 'Housekeeping' },
  { value: 'ASSET', label: 'Asset / Durable Equipment' },
  { value: 'PACKAGING', label: 'Packaging' },
] as const;

type StockItemForEdit = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  baseUnit: string;
  stockType: string;
  reorderLevel: number | null;
  isActive: boolean;
  quantityOnHand: number;
  costPrice: number;
  purchaseUnit: string;
  unitsInBase: number;
  purchaseCost: number | null;
  warehouseName: string;
};

export function StockItemQuickEditDialog({
  item,
  open,
  onOpenChange,
}: {
  item: StockItemForEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [stockType, setStockType] = useState('CONSUMABLE');
  const [reorderLevel, setReorderLevel] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [quantity, setQuantity] = useState('');
  const [baseUnit, setBaseUnit] = useState('');
  const [purchaseUnit, setPurchaseUnit] = useState('');
  const [unitsInBase, setUnitsInBase] = useState('1');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!item) return;
    setName(item.name);
    setStockType(item.stockType || 'CONSUMABLE');
    setReorderLevel(item.reorderLevel === null ? '' : String(item.reorderLevel));
    setIsActive(item.isActive);
    setQuantity(String(Number(item.quantityOnHand) / Number(item.unitsInBase || 1)));
    setBaseUnit(item.baseUnit);
    setPurchaseUnit(item.purchaseUnit || item.baseUnit);
    setUnitsInBase(String(item.unitsInBase || 1));
    setCostPerUnit(String(item.purchaseCost == null
      ? roundCurrency(Number(item.costPrice) * Number(item.unitsInBase || 1))
      : item.purchaseCost));
    setError('');
  }, [item]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;

    setSaving(true);
    setError('');
    const baseUnitChanged = baseUnit !== item.baseUnit;
    const baseConversion = baseUnitChanged && purchaseUnit === item.baseUnit ? Number(unitsInBase || 0) : 0;
    const purchaseConversion = purchaseUnit === item.baseUnit ? 1 : Number(unitsInBase || 0);
    if (!Number.isFinite(purchaseConversion) || purchaseConversion <= 0) {
      setError('Enter a valid units-in-base conversion before saving.');
      setSaving(false);
      return;
    }
    if (baseUnitChanged && (!Number.isFinite(baseConversion) || baseConversion <= 0)) {
      setError(`To change the base unit, enter how many ${baseUnit.toLowerCase()} make one ${item.baseUnit.toLowerCase()}.`);
      setSaving(false);
      return;
    }
    try {
      const response = await fetch(`/api/v1/inventory/stock-items/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          quantityOnHand: Number(quantity) * purchaseConversion,
          costPrice: Number(costPerUnit) / purchaseConversion,
          baseUnit,
          baseConversion,
          stockType,
          reorderLevel: reorderLevel.trim() === '' ? null : Number(reorderLevel),
          isActive,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not update stock item');

      if (purchaseUnit !== baseUnit) {
        const unitResponse = await fetch(`/api/v1/inventory/stock-items/${item.id}/units`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ unit: purchaseUnit, unitsInBase: Number(unitsInBase), purchaseCost: Number(costPerUnit), isPurchaseUnit: true }),
        });
        const unitResult = await unitResponse.json();
        if (!unitResponse.ok) throw new Error(unitResult.error || 'Could not save purchase unit');
      }

      onOpenChange(false);
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not update stock item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}>
      <DialogContent className="max-h-[92vh] w-[calc(100%-1.5rem)] overflow-y-auto border-white/[0.08] bg-[#111c2e] p-0 text-slate-100 sm:max-w-lg">
        <DialogHeader className="border-b border-white/[0.07] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2.5 text-cyan-300">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg text-white">Quick edit stock item</DialogTitle>
              <DialogDescription className="mt-1 text-slate-400">Update the temporary stock entry without leaving the register.</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {item && (
          <form onSubmit={save} className="space-y-5 px-6 py-5">
            {error && <div className="flex items-start gap-2 rounded-xl border border-rose-400/20 bg-rose-400/[.07] p-3 text-sm text-rose-200"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

            <div className="flex items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-3">
              <Package className="h-4 w-4 text-cyan-300" />
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-200">{item.name}</p><p className="text-xs text-slate-500">{item.warehouseName} · {(Number(item.quantityOnHand) / Number(item.unitsInBase || 1)).toLocaleString()} {item.purchaseUnit || item.baseUnit} on hand</p></div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Item name</span><input required value={name} onChange={(event) => setName(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3 text-sm text-white outline-none focus:border-cyan-400/60" /></label>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Stock type</span><select value={stockType} onChange={(event) => setStockType(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3 text-sm text-white outline-none focus:border-cyan-400/60">{STOCK_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Reorder level</span><input type="number" min="0" step="0.01" value={reorderLevel} onChange={(event) => setReorderLevel(event.target.value)} placeholder="No alert threshold" className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3 text-sm text-white outline-none focus:border-cyan-400/60" /></label>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Quantity / {(item.purchaseUnit || item.baseUnit).toLowerCase()} <em className="text-cyan-300">*</em></span><input required type="number" min="0" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3 text-sm text-white outline-none focus:border-cyan-400/60" /></label>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Base unit <em className="text-cyan-300">*</em></span><select required value={baseUnit} onChange={(event) => setBaseUnit(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3 text-sm text-white outline-none focus:border-cyan-400/60">{INVENTORY_UNITS.map((unit) => <option key={unit} value={unit}>{unit.charAt(0) + unit.slice(1).toLowerCase()}</option>)}</select></label>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Cost / {purchaseUnit ? purchaseUnit.toLowerCase() : 'purchase unit'} <em className="text-cyan-300">*</em></span><input required type="number" min="0" step="0.01" value={costPerUnit} onChange={(event) => setCostPerUnit(event.target.value)} className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3 text-sm text-white outline-none focus:border-cyan-400/60" /><span className="mt-1 block text-[11px] text-slate-600">Converted and stored per {item.baseUnit.toLowerCase()}.</span></label>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Purchase unit <em className="text-cyan-300">*</em></span><select required value={purchaseUnit} onChange={(event) => { const next = event.target.value; setPurchaseUnit(next); if (next === baseUnit) setUnitsInBase('1'); else if (next !== item.purchaseUnit) setUnitsInBase(''); }} className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3 text-sm text-white outline-none focus:border-cyan-400/60">{[item.baseUnit, ...INVENTORY_UNITS].filter((unit, index, all) => all.indexOf(unit) === index).map((unit) => <option key={unit} value={unit}>{unit.charAt(0) + unit.slice(1).toLowerCase()}</option>)}</select></label>
              <label><span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Units in base <em className="text-cyan-300">*</em></span><input required type="number" min="0.000001" step="0.000001" value={unitsInBase} onChange={(event) => setUnitsInBase(event.target.value)} disabled={purchaseUnit === baseUnit} className="h-11 w-full rounded-xl border border-white/10 bg-[#0d1832] px-3 text-sm text-white outline-none focus:border-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-50" /><span className="mt-1 block text-[11px] text-slate-600">How many base units are in one purchase unit.</span></label>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3"><input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} className="h-4 w-4 accent-cyan-400" /><span><span className="block text-sm font-semibold text-slate-200">Item is active</span><span className="block text-xs text-slate-500">Inactive items are hidden from stock operations.</span></span></label>

            <div className="grid gap-2 text-xs text-slate-500 sm:grid-cols-2"><span>SKU: <strong className="font-mono font-normal text-slate-400">{item.sku || '—'}</strong></span><span>Barcode: <strong className="font-mono font-normal text-slate-400">{item.barcode || '—'}</strong></span></div>

            <DialogFooter className="-mx-6 -mb-5 border-white/[0.07] bg-white/[0.02] px-6">
              <button type="button" onClick={() => onOpenChange(false)} disabled={saving} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-400 hover:bg-white/[0.05]">Cancel</button>
              <button type="submit" disabled={saving || !name.trim()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}{saving ? 'Saving…' : 'Save changes'}</button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
