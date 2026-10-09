'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { INVENTORY_UNITS, formatUnit } from '@/lib/inventory/units';

type StockSuggestion = {
  id: string;
  name: string;
  baseUnit: string;
  stockType: string;
};

export default function NewStockItemPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockTypes, setStockTypes] = useState<{ value: string; label: string }[]>([]);
  const [name, setName] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [baseUnit, setBaseUnit] = useState(INVENTORY_UNITS[0] || 'UNIT');
  const [stockType, setStockType] = useState('CONSUMABLE');
  const [suggestions, setSuggestions] = useState<StockSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  useEffect(() => {
    fetch('/api/v1/inventory/warehouses')
      .then((res) => res.json())
      .then((data) => setWarehouses((data.data || []).filter((warehouse: any) => warehouse.posOutletId == null)))
      .catch((err) => console.error('Failed to fetch warehouses', err));

    fetch('/api/v1/inventory/stock-types')
      .then((res) => res.json())
      .then((data) => {
        if (!data.data?.length) throw new Error('No stock types returned');
        setStockTypes(data.data);
      })
      .catch(() => setError('Failed to load stock types'));
  }, []);

  useEffect(() => {
    const query = name.trim();
    if (!warehouseId || query.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSuggestionsLoading(true);
      try {
        const response = await fetch(`/api/v1/inventory/stock-items?warehouseId=${encodeURIComponent(warehouseId)}&search=${encodeURIComponent(query)}&limit=8`, { signal: controller.signal });
        const body = await response.json();
        setSuggestions(body.data?.items || []);
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSuggestionsLoading(false);
      }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [name, warehouseId]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const data = {
      name,
      warehouseId,
      sku: formData.get('sku'),
      barcode: formData.get('barcode'),
      baseUnit,
      stockType,
      reorderLevel: formData.get('reorderLevel') ? parseInt(formData.get('reorderLevel') as string) : null,
    };

    try {
      const res = await fetch('/api/v1/inventory/stock-items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || result.message || 'Failed to create item');
      }

      router.push('/inventory/stock-items');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">New Stock Item</h1>
        <p className="text-slate-500">Add a new item to your inventory catalog.</p>
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
              <div className="relative">
                <input required id="name" name="name" type="text" value={name} onChange={(event) => { const value = event.target.value; setName(value); if (!warehouseId || value.trim().length < 2) { setSuggestions([]); setSuggestionsLoading(false); } }} autoComplete="off" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Premium Towel" />
                {(suggestionsLoading || suggestions.length > 0) && (
                  <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
                    {suggestionsLoading && <p className="px-3 py-2 text-xs text-slate-500">Checking existing stock…</p>}
                    {suggestions.map((item) => (
                      <button key={item.id} type="button" onClick={() => { setName(item.name); setBaseUnit(item.baseUnit); setStockType(item.stockType); setSuggestions([]); }} className="block w-full border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-indigo-50">
                        <span className="block text-sm font-medium text-slate-800">{item.name}</span>
                        <span className="block text-xs text-slate-500">{item.baseUnit} · {item.stockType?.replace(/_/g, ' ')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 col-span-2 md:col-span-1">
              <label htmlFor="warehouseId" className="text-sm font-medium text-slate-800">Main Warehouse *</label>
              <select required id="warehouseId" name="warehouseId" value={warehouseId} onChange={(event) => { setWarehouseId(event.target.value); setSuggestions([]); }} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                <option value="">Select Main Warehouse</option>
                {warehouses.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="sku" className="text-sm font-medium text-slate-800">SKU</label>
              <input id="sku" name="sku" type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Auto-generated if blank" />
            </div>

            <div className="space-y-2">
              <label htmlFor="barcode" className="text-sm font-medium text-slate-800">Barcode</label>
              <input id="barcode" name="barcode" type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Auto-generated if blank" />
            </div>

            <div className="space-y-2">
              <label htmlFor="baseUnit" className="text-sm font-medium text-slate-800">Base Unit *</label>
              <select required id="baseUnit" name="baseUnit" value={baseUnit} onChange={(event) => setBaseUnit(event.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {INVENTORY_UNITS.map(unit => (
                  <option key={unit} value={unit}>{formatUnit(unit)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="stockType" className="text-sm font-medium text-slate-800">Stock Type *</label>
              <select required disabled={!stockTypes.length} id="stockType" name="stockType" value={stockType} onChange={(event) => setStockType(event.target.value)} className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-wait disabled:opacity-60">
                {!stockTypes.length && <option value="">Loading stock types…</option>}
                {stockTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">Stock types are loaded from the database schema. This creates one item in the selected main warehouse; an outlet item is created only when stock is transferred there.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-800">Initial Cost Price</label>
              <div className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-500 font-medium flex items-center justify-between cursor-not-allowed">
                <span>0.00</span>
                <span className="text-xs text-slate-400 font-normal">Calculated upon first receipt (MAC)</span>
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="reorderLevel" className="text-sm font-medium text-slate-800">Reorder Level</label>
              <input id="reorderLevel" name="reorderLevel" type="number" min="0" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Alert threshold" />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-200">
            <Link href="/inventory/stock-items" className="px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 transition-colors">
              Cancel
            </Link>
            <button disabled={loading} type="submit" className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-slate-900 text-sm font-medium rounded-md transition-colors disabled:opacity-50">
              {loading ? 'Creating...' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
