'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Truck, Loader2, ArrowLeft, Plus, Save, Trash } from 'lucide-react';
import Link from 'next/link';
import { UnitOfMeasure } from '@hotel-pms/db';

export default function NewPurchaseOrderPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    supplierId: '',
    expectedDate: '',
    notes: '',
  });

  const [poItems, setPoItems] = useState<any[]>([{ stockItemId: '', description: '', quantity: '', unitPrice: '', unitOfMeasure: 'KG' }]);

  useEffect(() => {
    Promise.all([
      fetch('/api/v1/inventory/suppliers').then(r => r.json()),
      fetch('/api/v1/inventory/stock-items').then(r => r.json())
    ]).then(([supRes, stockRes]) => {
      setSuppliers(supRes.data || []);
      setStockItems(stockRes.data?.items || []);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/inventory/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          items: poItems.filter(i => i.stockItemId && Number(i.quantity) > 0)
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to create PO');
      
      router.push('/fnb/purchasing');
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => setPoItems([...poItems, { stockItemId: '', description: '', quantity: '', unitPrice: '', unitOfMeasure: 'KG' }]);
  const removeItem = (idx: number) => setPoItems(poItems.filter((_, i) => i !== idx));

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-8 font-sans">
      <div className="max-w-5xl mx-auto">
        <header className="mb-8">
          <Link href="/fnb/purchasing" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Purchase Orders
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 mb-2">
            <Truck className="h-4 w-4" /> Procurement
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">New Purchase Order</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          
          <div className="grid grid-cols-2 gap-6 pb-6 border-b border-slate-100">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Supplier</label>
              <select
                required
                value={formData.supplierId}
                onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="" disabled>Select a supplier...</option>
                {suppliers.map(sup => (
                  <option key={sup.id} value={sup.id}>{sup.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Expected Delivery</label>
              <input
                type="date"
                required
                value={formData.expectedDate}
                onChange={e => setFormData({ ...formData, expectedDate: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-900">Order Items</h3>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                <Plus className="h-3 w-3" /> Add Row
              </button>
            </div>

            <div className="space-y-3">
              {poItems.map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Stock Item (Destination Derived)</label>
                    <select
                      required
                      value={item.stockItemId}
                      onChange={e => {
                        const newItems = [...poItems];
                        newItems[idx].stockItemId = e.target.value;
                        setPoItems(newItems);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
                    >
                      <option value="">Select Item...</option>
                      {stockItems.map(si => (
                        <option key={si.id} value={si.id}>{si.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Qty</label>
                    <input
                      type="number" required min="0.01" step="0.01"
                      value={item.quantity}
                      onChange={e => {
                        const newItems = [...poItems];
                        newItems[idx].quantity = e.target.value;
                        setPoItems(newItems);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Unit</label>
                    <select
                      required
                      value={item.unitOfMeasure}
                      onChange={e => {
                        const newItems = [...poItems];
                        newItems[idx].unitOfMeasure = e.target.value;
                        setPoItems(newItems);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
                    >
                      {Object.keys(UnitOfMeasure).map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-bold text-slate-500 mb-1">Unit Price</label>
                    <input
                      type="number" required min="0" step="0.01"
                      value={item.unitPrice}
                      onChange={e => {
                        const newItems = [...poItems];
                        newItems[idx].unitPrice = e.target.value;
                        setPoItems(newItems);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none"
                    />
                  </div>
                  <div className="pt-6">
                    <button type="button" onClick={() => removeItem(idx)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg">
                      <Trash className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-sm font-bold text-slate-700 mb-1.5">Internal Notes</label>
            <textarea
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none min-h-[80px]"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Link href="/fnb/purchasing" className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || poItems.length === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Create Purchase Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
