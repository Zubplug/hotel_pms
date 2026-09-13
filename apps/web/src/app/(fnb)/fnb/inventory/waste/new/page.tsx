'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2, Loader2, ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { UnitOfMeasure, KitchenWasteReason } from '@hotel-pms/db';

export default function NewWasteEntryPage() {
  const router = useRouter();
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  const [formData, setFormData] = useState({
    stockItemId: '',
    quantity: '',
    unitOfMeasure: 'KG',
    reason: 'SPOILAGE' as KitchenWasteReason,
    notes: '',
  });

  useEffect(() => {
    fetch('/api/v1/inventory/stock-items')
      .then(res => res.json())
      .then(res => {
        setStockItems(res.data || []);
      })
      .finally(() => setFetching(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/v1/inventory/waste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to submit waste');
      
      router.push('/fnb/inventory/waste');
      router.refresh();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 sm:p-8 font-sans">
      <div className="max-w-2xl mx-auto">
        <header className="mb-8">
          <Link href="/fnb/inventory/waste" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900 transition mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Waste Log
          </Link>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-rose-600 mb-2">
            <Trash2 className="h-4 w-4" /> Log Waste
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">New Waste Entry</h1>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Stock Item</label>
              <select
                required
                disabled={fetching}
                value={formData.stockItemId}
                onChange={e => setFormData({ ...formData, stockItemId: e.target.value })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-rose-500 focus:ring-1 focus:ring-rose-500 disabled:opacity-50"
              >
                <option value="" disabled>Select a stock item...</option>
                {stockItems.map(item => (
                  <option key={item.id} value={item.id}>{item.name} ({item.quantityOnHand} {item.baseUnit} available)</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Quantity</label>
                <input
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Unit</label>
                <select
                  required
                  value={formData.unitOfMeasure}
                  onChange={e => setFormData({ ...formData, unitOfMeasure: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
                >
                  {Object.keys(UnitOfMeasure).map(unit => (
                    <option key={unit} value={unit}>{unit}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Reason Code</label>
              <select
                required
                value={formData.reason}
                onChange={e => setFormData({ ...formData, reason: e.target.value as KitchenWasteReason })}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              >
                {Object.keys(KitchenWasteReason).map(reason => (
                  <option key={reason} value={reason}>{reason.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Notes & Evidence (Optional)</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder="E.g. Dropped during service, found expired in walk-in..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm outline-none transition focus:border-rose-500 focus:ring-1 focus:ring-rose-500 min-h-[100px]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <Link href="/fnb/inventory/waste" className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:text-slate-900 transition">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Submit for Approval
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
