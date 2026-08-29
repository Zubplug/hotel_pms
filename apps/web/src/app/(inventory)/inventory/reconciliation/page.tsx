'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ClipboardList, CheckCircle, AlertTriangle, Loader2, RefreshCw, Info } from 'lucide-react';

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
  'SPOILAGE', 'THEFT', 'DAMAGE', 'MISCOUNT', 'WASTE', 'EXPIRY', 'OPENING_BALANCE', 'OTHER',
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
      .then((r) => r.json())
      .then((r) => setItems(r.data?.items || []));
  }, []);

  useEffect(() => {
    const item = items.find((i) => i.id === selectedItemId) || null;
    setSelectedItem(item);
    setActualQty('');
  }, [selectedItemId, items]);

  const systemQty = selectedItem ? Number(selectedItem.quantityOnHand) : null;
  const parsedActual = actualQty !== '' ? parseFloat(actualQty) : null;
  const variance =
    parsedActual !== null && systemQty !== null ? parsedActual - systemQty : null;

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

  const canSubmit =
    !isSubmitting && selectedItem !== null && parsedActual !== null && variance !== 0;

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#0f2619] px-8 py-7">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Ad-Hoc Stock Adjustment</h1>
          <p className="text-slate-400 text-sm mt-1">
            Submit a physically counted quantity for management approval.
          </p>
        </div>
      </div>

      <div className="px-6 py-7 max-w-2xl mx-auto space-y-5">
        {/* Approval notice */}
        <div className="flex gap-3 bg-blue-50 border border-blue-200 rounded-2xl p-4">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <span className="font-bold">Approval required. </span>
            Adjustments are not applied immediately. A Manager, CEO, or Super Admin must review
            and approve before stock quantities change.
          </div>
        </div>

        {success && (
          <div className="flex gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-700 font-medium">{success}</p>
          </div>
        )}

        {error && (
          <div className="flex gap-3 bg-red-50 border border-red-200 rounded-2xl p-4">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-5">
          {/* Item selection */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Select Stock Item <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400 transition-colors"
            >
              <option value="">Choose an item to adjust…</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} {item.sku ? `(${item.sku})` : ''} — {item.warehouse?.name}
                </option>
              ))}
            </select>
          </div>

          {/* System vs actual comparison */}
          {selectedItem && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-3 gap-4">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">System Qty</p>
                <p className="text-2xl font-black text-slate-900">{systemQty!.toFixed(2)}</p>
                <p className="text-xs text-slate-400 mt-0.5">{selectedItem.baseUnit}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Warehouse</p>
                <p className="text-sm font-bold text-slate-700 mt-1">{selectedItem.warehouse?.name}</p>
              </div>
              {variance !== null && (
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Variance</p>
                  <p
                    className={`text-2xl font-black ${
                      variance === 0
                        ? 'text-emerald-600'
                        : variance > 0
                        ? 'text-blue-600'
                        : 'text-red-600'
                    }`}
                  >
                    {variance > 0 ? '+' : ''}{variance.toFixed(2)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {variance === 0 ? 'No change' : variance > 0 ? 'Surplus' : 'Deficit'}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Counted quantity */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Physically Counted Quantity <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              value={actualQty}
              onChange={(e) => setActualQty(e.target.value)}
              required
              disabled={!selectedItem}
              placeholder="Enter the actual counted quantity"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400 disabled:opacity-40 transition-colors"
            />
          </div>

          {/* Reason */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">
              Adjustment Reason <span className="text-red-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400 transition-colors"
            >
              {ADJUSTMENT_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Optional explanation for the adjustment…"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-400 resize-none transition-colors"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={() => {
                setSelectedItemId('');
                setActualQty('');
                setNotes('');
                setError('');
                setSuccess('');
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-sm font-medium transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Reset
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardList className="h-4 w-4" />
              )}
              {isSubmitting ? 'Submitting…' : 'Submit for Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
