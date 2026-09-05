'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { INVENTORY_UNITS, formatUnit } from '@/lib/inventory/units';

export default function EditStockItemPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [item, setItem] = useState<any>(null);
  const [unitForm, setUnitForm] = useState({ unit: 'CARTON', unitsInBase: '', barcode: '', isPurchaseUnit: true, isIssueUnit: false });
  const [unitSaving, setUnitSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/inventory/stock-items/${params.id}`)
      .then((res) => res.json())
      .then((data) => setItem(data.data))
      .catch((err) => console.error('Failed to fetch item', err));
  }, [params.id]);

  const saveUnit = async () => {
    setUnitSaving(true);
    try {
      const res = await fetch(`/api/v1/inventory/stock-items/${params.id}/units`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(unitForm) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save unit conversion');
      setItem((current: any) => ({ ...current, stockUnits: [...(current.stockUnits || []).filter((unit: any) => unit.unit !== json.data.unit), json.data] }));
      setUnitForm({ unit: 'CARTON', unitsInBase: '', barcode: '', isPurchaseUnit: true, isIssueUnit: false });
    } catch (err: any) { setError(err.message); } finally { setUnitSaving(false); }
  };

  const deleteUnit = async (unit: string) => {
    const res = await fetch(`/api/v1/inventory/stock-items/${params.id}/units?unit=${unit}`, { method: 'DELETE' });
    if (res.ok) setItem((current: any) => ({ ...current, stockUnits: (current.stockUnits || []).filter((entry: any) => entry.unit !== unit) }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      sku: formData.get('sku'),
      barcode: formData.get('barcode'),
      stockType: formData.get('stockType'),
      reorderLevel: formData.get('reorderLevel') ? parseInt(formData.get('reorderLevel') as string) : null,
      isActive: formData.get('isActive') === 'on',
    };

    try {
      const res = await fetch(`/api/v1/inventory/stock-items/${params.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || result.message || 'Failed to update item');
      }

      router.push(`/inventory/stock-items/${params.id}`);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (!item) {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center text-slate-500 py-12">
        Loading...
      </div>
    );
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4 mb-2">
        <Link href={`/inventory/stock-items/${params.id}`} className="p-2 bg-white border border-slate-200 rounded-md text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Edit Stock Item</h1>
          <p className="text-slate-500">Update details for {item.name}</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-500/20 rounded-md text-sm text-red-500">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2 col-span-2 md:col-span-1">
              <label htmlFor="name" className="text-sm font-medium text-slate-800">Name *</label>
              <input required id="name" name="name" type="text" defaultValue={item.name} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Premium Towel" />
            </div>

            <div className="space-y-2 col-span-2 md:col-span-1">
              <label className="text-sm font-medium text-slate-800">Warehouse (Read-only)</label>
              <input type="text" disabled defaultValue={item.warehouse?.name} className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-slate-500 cursor-not-allowed" />
            </div>

            <div className="space-y-2">
              <label htmlFor="sku" className="text-sm font-medium text-slate-800">SKU</label>
              <input id="sku" name="sku" type="text" defaultValue={item.sku || ''} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Optional" />
            </div>

            <div className="space-y-2">
              <label htmlFor="barcode" className="text-sm font-medium text-slate-800">Barcode</label>
              <input id="barcode" name="barcode" type="text" defaultValue={item.barcode || ''} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Optional" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">Base Unit (Read-only)</label>
              <input type="text" disabled defaultValue={item.baseUnit} className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-slate-500 cursor-not-allowed" />
            </div>

            <div className="space-y-2">
              <label htmlFor="stockType" className="text-sm font-medium text-slate-800">Stock Type *</label>
              <select required id="stockType" name="stockType" defaultValue={item.stockType || 'CONSUMABLE'} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="SELLABLE">Sellable / Resale</option>
                <option value="RAW_MATERIAL">Raw Material / Production</option>
                <option value="CONSUMABLE">General Consumable</option>
                <option value="CLEANING">Cleaning</option>
                <option value="HOUSEKEEPING">Housekeeping</option>
                <option value="ASSET">Asset / Durable Equipment</option>
                <option value="PACKAGING">Packaging</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">Current Valuation Cost (MAC)</label>
              <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-md text-slate-500 font-medium flex items-center justify-between cursor-not-allowed">
                <span>{Number(item.costPrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                <span className="text-xs text-slate-400 font-normal">System Computed</span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="reorderLevel" className="text-sm font-medium text-slate-800">Reorder Level</label>
              <input id="reorderLevel" name="reorderLevel" type="number" min="0" defaultValue={item.reorderLevel || ''} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Alert threshold" />
            </div>
            
            <div className="space-y-2 col-span-2">
              <div className="flex items-center gap-2">
                <input id="isActive" name="isActive" type="checkbox" defaultChecked={item.isActive} className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <label htmlFor="isActive" className="text-sm font-medium text-slate-800">Item is active</label>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-slate-200 pt-6">
            <h2 className="text-sm font-semibold text-slate-900">Packaging & Unit Conversions</h2>
            <p className="mt-1 text-xs text-slate-500">Base unit: <strong>{formatUnit(item.baseUnit)}</strong>. Add purchase or issue units, such as 1 carton = 12 bottles.</p>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div><label className="text-xs font-medium text-slate-700">Unit</label><select value={unitForm.unit} onChange={(e) => setUnitForm({ ...unitForm, unit: e.target.value })} className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900">{INVENTORY_UNITS.map((unit) => <option key={unit} value={unit} disabled={unit === item.baseUnit}>{formatUnit(unit)}</option>)}</select></div>
              <div><label className="text-xs font-medium text-slate-700">Units in base</label><input type="number" min="0.000001" step="0.000001" value={unitForm.unitsInBase} onChange={(e) => setUnitForm({ ...unitForm, unitsInBase: e.target.value })} placeholder={`e.g. 12 ${item.baseUnit}`} className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900" /></div>
              <div><label className="text-xs font-medium text-slate-700">Barcode (optional)</label><input value={unitForm.barcode} onChange={(e) => setUnitForm({ ...unitForm, barcode: e.target.value })} className="mt-1 w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900" /></div>
              <button type="button" onClick={saveUnit} disabled={unitSaving || !unitForm.unitsInBase} className="px-4 py-2 bg-slate-900 text-white rounded-md text-sm disabled:opacity-50">{unitSaving ? 'Saving...' : 'Save Conversion'}</button>
            </div>
            {(item.stockUnits || []).length > 0 && <div className="mt-4 divide-y divide-slate-100 border border-slate-200 rounded-lg">{item.stockUnits.map((unit: any) => <div key={unit.id} className="flex items-center justify-between px-3 py-2 text-sm"><span className="font-medium text-slate-800">1 {formatUnit(unit.unit)} = {Number(unit.unitsInBase)} {formatUnit(item.baseUnit)}</span><span className="flex items-center gap-3 text-xs text-slate-500">{unit.isPurchaseUnit && 'Purchase'}{unit.isIssueUnit && ' · Issue'}<button type="button" onClick={() => deleteUnit(unit.unit)} className="text-red-600 hover:text-red-800">Remove</button></span></div>)}</div>}
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
            <Link href={`/inventory/stock-items/${params.id}`} className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
              Cancel
            </Link>
            <button disabled={loading} type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-md transition-colors disabled:opacity-50">
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
