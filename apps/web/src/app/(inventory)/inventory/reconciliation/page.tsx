'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, CheckCircle, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';

interface StockItem {
  id: string;
  name: string;
  sku: string | null;
  quantityOnHand: number;
  baseUnit: string;
  warehouseId: string;
  warehouse: { name: string };
}

const ADJUSTMENT_REASONS = [
  'SPOILAGE', 'THEFT', 'DAMAGE', 'MISCOUNT', 'WASTE', 'EXPIRY', 'OPENING_BALANCE', 'OTHER'
];

export default function ReconciliationPage() {
  const router = useRouter();
  const [items, setItems] = useState<StockItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedItem, setSelectedItem] = useState<StockItem | null>(null);
  const [actualQty, setActualQty] = useState('');
  const [reason, setReason] = useState('MISCOUNT');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/v1/inventory/stock-items?limit=200')
      .then(r => r.json())
      .then(r => setItems(r.data?.items || []));
  }, []);

  useEffect(() => {
    const item = items.find(i => i.id === selectedItemId) || null;
    setSelectedItem(item);
    setActualQty('');
  }, [selectedItemId, items]);

  const systemQty = selectedItem ? Number(selectedItem.quantityOnHand) : null;
  const parsedActual = actualQty !== '' ? parseFloat(actualQty) : null;
  const variance = parsedActual !== null && systemQty !== null ? parsedActual - systemQty : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedItem || parsedActual === null) return;
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    const res = await fetch('/api/v1/inventory/reconcile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stockItemId: selectedItem.id,
        warehouseId: selectedItem.warehouseId,
        currentQty: systemQty,
        actualQty: parsedActual,
        reason,
        notes,
      }),
    });

    const json = await res.json();
    if (!res.ok || json.error) {
      setError(json.error || 'Failed to submit adjustment');
    } else {
      setSuccess('Adjustment submitted for approval. A manager will review it shortly.');
      setSelectedItemId('');
      setActualQty('');
      setNotes('');
    }
    setIsSubmitting(false);
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2 bg-amber-50 rounded-lg">
          <ClipboardList className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock Reconciliation</h1>
          <p className="text-slate-500 text-sm mt-0.5">Submit a counted quantity for management approval</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 border border-blue-500/20 rounded-xl p-4 flex gap-3 mb-6">
        <AlertTriangle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-300">
          <span className="font-semibold">Approval Required. </span>
          Adjustments are not applied immediately. A Manager, CEO, or Super Admin must review and approve them before stock quantities change.
        </div>
      </div>

      {success && (
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 flex gap-3 mb-6">
          <CheckCircle className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
          <p className="text-sm text-green-300">{success}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5 bg-slate-50 border border-slate-300 rounded-xl p-6">
        {/* Item selection */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Select Stock Item *</label>
          <select
            value={selectedItemId}
            onChange={e => setSelectedItemId(e.target.value)}
            required
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            <option value="">Choose an item to reconcile...</option>
            {items.map(item => (
              <option key={item.id} value={item.id}>
                {item.name} {item.sku ? `(${item.sku})` : ''} — {item.warehouse?.name}
              </option>
            ))}
          </select>
        </div>

        {/* System vs actual comparison */}
        {selectedItem && (
          <div className="bg-slate-900/60 border border-slate-300 rounded-lg p-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">System Quantity</span>
              <p className="text-2xl font-bold text-slate-900">{systemQty!.toFixed(4)}</p>
              <span className="text-slate-500 text-xs">{selectedItem.baseUnit}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">Warehouse</span>
              <p className="text-slate-900 font-semibold mt-1">{selectedItem.warehouse?.name}</p>
            </div>
            {variance !== null && (
              <div>
                <span className="text-slate-500 block text-xs uppercase tracking-wider mb-1">Variance</span>
                <p className={`text-2xl font-bold ${variance === 0 ? 'text-green-400' : variance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                  {variance > 0 ? '+' : ''}{variance.toFixed(4)}
                </p>
                <span className="text-slate-500 text-xs">{variance === 0 ? 'No change' : variance > 0 ? 'Surplus' : 'Deficit'}</span>
              </div>
            )}
          </div>
        )}

        {/* Actual count */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Physically Counted Quantity *</label>
          <input
            type="number"
            step="0.0001"
            min="0"
            value={actualQty}
            onChange={e => setActualQty(e.target.value)}
            required
            disabled={!selectedItem}
            placeholder="Enter the actual counted quantity"
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-40"
          />
        </div>

        {/* Reason */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Adjustment Reason *</label>
          <select
            value={reason}
            onChange={e => setReason(e.target.value)}
            required
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50"
          >
            {ADJUSTMENT_REASONS.map(r => (
              <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>

        {/* Notes */}
        <div>
          <label className="text-sm font-medium text-slate-700 mb-1.5 block">Notes</label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={3}
            placeholder="Optional explanation for the adjustment..."
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-slate-900 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-500/30 rounded-lg px-4 py-3 text-red-600 text-sm">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={() => { setSelectedItemId(''); setActualQty(''); setNotes(''); setError(''); setSuccess(''); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:text-slate-900 text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Reset
          </button>
          <button
            type="submit"
            disabled={isSubmitting || !selectedItem || parsedActual === null || variance === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-slate-900 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardList className="w-4 h-4" />}
            {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
          </button>
        </div>
      </form>
    </div>
  );
}
