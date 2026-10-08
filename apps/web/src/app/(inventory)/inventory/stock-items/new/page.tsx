'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { INVENTORY_UNITS, formatUnit } from '@/lib/inventory/units';

export default function NewStockItemPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [stockTypes, setStockTypes] = useState<{ value: string; label: string }[]>([]);

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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      warehouseId: formData.get('warehouseId'),
      sku: formData.get('sku'),
      barcode: formData.get('barcode'),
      baseUnit: formData.get('baseUnit'),
      stockType: formData.get('stockType'),
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
        throw new Error(result.message || 'Failed to create item');
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
              <input required id="name" name="name" type="text" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="e.g. Premium Towel" />
            </div>

            <div className="space-y-2 col-span-2 md:col-span-1">
              <label htmlFor="warehouseId" className="text-sm font-medium text-slate-800">Main Warehouse *</label>
              <select required id="warehouseId" name="warehouseId" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
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
              <select required id="baseUnit" name="baseUnit" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500">
                {INVENTORY_UNITS.map(unit => (
                  <option key={unit} value={unit}>{formatUnit(unit)}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label htmlFor="stockType" className="text-sm font-medium text-slate-800">Stock Type *</label>
              <select required disabled={!stockTypes.length} id="stockType" name="stockType" defaultValue="CONSUMABLE" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-wait disabled:opacity-60">
                {!stockTypes.length && <option value="">Loading stock types…</option>}
                {stockTypes.map((type) => (
                  <option key={type.value} value={type.value}>{type.label}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">Stock types are loaded from the database schema. Raw materials are provisioned only to the configured Kitchen Service outlet; other types are provisioned to active outlet warehouses.</p>
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
