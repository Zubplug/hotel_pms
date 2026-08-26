'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftRight, Plus, Trash2, ChevronRight, Loader2 } from 'lucide-react';

interface Warehouse { id: string; name: string; }
interface StockItem { id: string; name: string; baseUnit: string; quantityOnHand: number; warehouseId: string; }

export default function NewTransferPage() {
  const router = useRouter();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  const [fromWarehouseId, setFromWarehouseId] = useState('');
  const [toWarehouseId, setToWarehouseId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState([{ stockItemId: '', quantity: '', unitOfMeasure: 'UNIT', notes: '' }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/inventory/warehouses').then(r => r.json()).then(r => setWarehouses(r.data?.warehouses || r.data || []));
    fetch('/api/v1/inventory/stock-items?limit=200').then(r => r.json()).then(r => setStockItems(r.data?.items || []));
  }, []);

  const fromItems = stockItems.filter(i => !fromWarehouseId || i.warehouseId === fromWarehouseId);

  const addLine = () => setLines(l => [...l, { stockItemId: '', quantity: '', unitOfMeasure: 'UNIT', notes: '' }]);
  const removeLine = (i: number) => setLines(l => l.filter((_, idx) => idx !== i));
  const updateLine = (i: number, field: string, value: string) =>
    setLines(l => l.map((ln, idx) => idx === i ? { ...ln, [field]: value } : ln));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fromWarehouseId || !toWarehouseId) { setError('Please select both warehouses.'); return; }
    if (fromWarehouseId === toWarehouseId) { setError('Source and destination must be different warehouses.'); return; }
    if (lines.some(l => !l.stockItemId || !l.quantity)) { setError('All transfer lines must have an item and quantity.'); return; }

    setIsSubmitting(true);
    setError('');

    const res = await fetch('/api/v1/inventory/transfers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fromWarehouseId,
        toWarehouseId,
        notes,
        items: lines.map(l => ({
          stockItemId: l.stockItemId,
          quantity: parseFloat(l.quantity),
          unitOfMeasure: l.unitOfMeasure,
          notes: l.notes,
        })),
      }),
    });

    const json = await res.json();
    if (!res.ok || json.error) {
      setError(json.error || 'Failed to create transfer');
      setIsSubmitting(false);
    } else {
      router.push(`/inventory/transfers/${json.data.id}`);
    }
  }

  const UNITS = ['UNIT', 'KG', 'GRAM', 'LITRE', 'ML', 'PIECE', 'DOZEN', 'BOX', 'CARTON'];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-indigo-500/10 rounded-lg">
          <ArrowLeftRight className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">New Stock Transfer</h1>
          <p className="text-slate-400 text-sm mt-0.5">Move stock between warehouses</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Warehouse Selection */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Transfer Route</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">From Warehouse *</label>
              <select
                value={fromWarehouseId}
                onChange={e => setFromWarehouseId(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="">Select source warehouse</option>
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">To Warehouse *</label>
              <select
                value={toWarehouseId}
                onChange={e => setToWarehouseId(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="">Select destination warehouse</option>
                {warehouses.filter(w => w.id !== fromWarehouseId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="text-sm font-medium text-slate-300 mb-1.5 block">Notes</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional reason or notes..."
              className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Items to Transfer</h2>
            <button type="button" onClick={addLine} className="flex items-center gap-1.5 text-sm text-indigo-400 hover:text-indigo-300 font-medium">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>

          <div className="space-y-3">
            {lines.map((line, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center bg-slate-900/50 border border-slate-700 rounded-lg p-3">
                <div className="col-span-4">
                  <select
                    value={line.stockItemId}
                    onChange={e => updateLine(i, 'stockItemId', e.target.value)}
                    required
                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  >
                    <option value="">Select item</option>
                    {fromItems.map(item => (
                      <option key={item.id} value={item.id}>{item.name} (Qty: {Number(item.quantityOnHand).toFixed(2)})</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={line.quantity}
                    onChange={e => updateLine(i, 'quantity', e.target.value)}
                    required
                    placeholder="Qty"
                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
                </div>
                <div className="col-span-2">
                  <select
                    value={line.unitOfMeasure}
                    onChange={e => updateLine(i, 'unitOfMeasure', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  >
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div className="col-span-3">
                  <input
                    type="text"
                    value={line.notes}
                    onChange={e => updateLine(i, 'notes', e.target.value)}
                    placeholder="Notes (optional)"
                    className="w-full bg-slate-900 border border-slate-600 rounded px-2 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  {lines.length > 1 && (
                    <button type="button" onClick={() => removeLine(i)} className="text-slate-500 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={() => router.back()} className="px-5 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:text-white text-sm font-medium transition-colors">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
            {isSubmitting ? 'Creating...' : 'Create Transfer'}
          </button>
        </div>
      </form>
    </div>
  );
}
