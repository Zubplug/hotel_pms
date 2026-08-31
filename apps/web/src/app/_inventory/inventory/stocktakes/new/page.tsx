'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, Loader2, ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';

export default function NewStocktakePage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  const [warehouseId, setWarehouseId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/inventory/warehouses?limit=100').then(r => r.json()).then(r => setWarehouses(r.data || []));
    fetch('/api/v1/inventory/categories?limit=100').then(r => r.json()).then(r => setCategories(r.data?.items || []));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!warehouseId) return;
    setIsSubmitting(true);
    setError('');

    const res = await fetch('/api/v1/inventory/stocktakes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ warehouseId, categoryId: categoryId || undefined, notes }),
    });

    const json = await res.json();
    if (!res.ok || json.error) {
      setError(json.error || 'Failed to create stocktake');
      setIsSubmitting(false);
    } else {
      router.push(`/inventory/stocktakes/${json.data.id}`);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link href="/inventory/stocktakes" className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-6 w-max">
        <ArrowLeft className="w-4 h-4" /> Back to Stocktakes
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-indigo-50 rounded-lg">
          <ClipboardList className="w-6 h-6 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Generate Stocktake</h1>
          <p className="text-slate-500 text-sm mt-0.5">Snapshot inventory levels for a physical count</p>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-500/20 rounded-xl p-4 flex gap-3 mb-6">
        <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800">
          <span className="font-semibold block mb-1">Snapshot Generated Immediately</span>
          Generating a stocktake freezes the "Expected Quantity" and "Cost" for all selected items based on this exact moment in time. 
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-6">
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Warehouse *</label>
          <select
            value={warehouseId}
            onChange={e => setWarehouseId(e.target.value)}
            required
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="">Select a warehouse...</option>
            {warehouses.map(w => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Category (Optional)</label>
          <select
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
          >
            <option value="">All Categories (Full Warehouse Count)</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <p className="text-xs text-slate-500 mt-1.5">Leave blank to count the entire warehouse, or select a category for a targeted cycle count.</p>
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="E.g., End of month beverage count..."
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg border border-red-500/20">
            {error}
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting || !warehouseId}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
            {isSubmitting ? 'Generating Snapshot...' : 'Generate Worksheet'}
          </button>
        </div>
      </form>
    </div>
  );
}
