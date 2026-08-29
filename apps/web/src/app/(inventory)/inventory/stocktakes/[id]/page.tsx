'use client';

import React, { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Send, CheckCircle, XCircle, FileText, AlertTriangle, Play, RefreshCw, Archive } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export default function StocktakeDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const { data: session } = useSession();
  
  const [stocktake, setStocktake] = useState<any>(null);
  const [counts, setCounts] = useState<Record<string, string>>({}); // Use string for input fields
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actioning, setActioning] = useState('');

  useEffect(() => {
    fetchData();
  }, [params.id]);

  const fetchData = async () => {
    setLoading(true);
    const res = await fetch(`/api/v1/inventory/stocktakes/${params.id}`);
    const json = await res.json();
    if (json.data) {
      setStocktake(json.data);
      // Initialize counts
      const initialCounts: Record<string, string> = {};
      json.data.items.forEach((item: any) => {
        if (item.countedQty !== null) {
          initialCounts[item.id] = item.countedQty.toString();
        }
      });
      setCounts(initialCounts);
    }
    setLoading(false);
  };

  const handleAction = async (action: string) => {
    if (!confirm(`Are you sure you want to ${action} this stocktake?`)) return;
    
    // If submitting, we must save counts first
    if (action === 'submit') {
      const saved = await saveCounts(false);
      if (!saved) return;
    }

    setActioning(action);
    const res = await fetch(`/api/v1/inventory/stocktakes/${params.id}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });

    if (res.ok) {
      await fetchData();
    } else {
      const json = await res.json();
      alert(json.error || 'Failed to perform action');
    }
    setActioning('');
  };

  const saveCounts = async (showNotification = true) => {
    setSaving(true);
    // Format counts payload
    const payload = Object.keys(counts).map(itemId => ({
      itemId,
      countedQty: counts[itemId] === '' ? null : parseFloat(counts[itemId])
    }));

    const res = await fetch(`/api/v1/inventory/stocktakes/${params.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ counts: payload }),
    });

    if (!res.ok) {
      const json = await res.json().catch(() => null);
      alert(json?.error || 'Failed to save counts');
      setSaving(false);
      return false;
    }

    if (showNotification) {
      // Could show a toast here
      await fetchData();
    }
    setSaving(false);
    return true;
  };

  if (loading) return <div className="p-12 text-center text-slate-500">Loading stocktake...</div>;
  if (!stocktake) return <div className="p-12 text-center text-red-500">Stocktake not found</div>;

  const role = (session?.user as any)?.role;
  const isSuperAdmin = (session?.user as any)?.isSuperAdmin;
  const canManage = hasInventoryPermission(role, 'inventory.stocktake', isSuperAdmin);
  const canApprove = hasInventoryPermission(role, 'inventory.stocktake.approve', isSuperAdmin);

  const isCountingMode = stocktake.status === 'COUNTING';
  const isReviewMode = ['SUBMITTED', 'APPROVED', 'COMPLETED', 'REJECTED'].includes(stocktake.status);

  // Formatting helpers
  const formatCurrency = (val: number) => new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(val);

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 pb-32">
      <Link href="/inventory/stocktakes" className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 mb-6 w-max">
        <ArrowLeft className="w-4 h-4" /> Back to Stocktakes
      </Link>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold text-slate-900">{stocktake.stocktakeRef}</h1>
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-700 tracking-wider">
              {stocktake.status}
            </span>
          </div>
          <div className="text-sm text-slate-500 grid grid-cols-2 gap-x-8 gap-y-2 mt-4">
            <div><span className="font-medium text-slate-700">Warehouse:</span> {stocktake.warehouse.name}</div>
            <div><span className="font-medium text-slate-700">Category:</span> {stocktake.category?.name || 'All'}</div>
            <div><span className="font-medium text-slate-700">Created:</span> {new Date(stocktake.createdAt).toLocaleDateString()}</div>
            <div><span className="font-medium text-slate-700">Items:</span> {stocktake.items.length}</div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex flex-wrap items-center gap-3">
          {stocktake.status === 'DRAFT' && canManage && (
            <>
              <button onClick={() => handleAction('cancel')} disabled={!!actioning} className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg">Cancel</button>
              <button onClick={() => handleAction('start')} disabled={!!actioning} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">
                <Play className="w-4 h-4" /> Start Counting
              </button>
            </>
          )}

          {isCountingMode && canManage && (
            <>
              <button onClick={() => saveCounts()} disabled={saving} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg">
                <Save className="w-4 h-4" /> Save Progress
              </button>
              <button onClick={() => handleAction('submit')} disabled={!!actioning || saving} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg">
                <Send className="w-4 h-4" /> Submit for Review
              </button>
            </>
          )}

          {stocktake.status === 'SUBMITTED' && canApprove && (
            <>
              <button onClick={() => handleAction('reject')} disabled={!!actioning} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg">
                <RefreshCw className="w-4 h-4" /> Request Recount
              </button>
              <button onClick={() => handleAction('approve')} disabled={!!actioning} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg">
                <CheckCircle className="w-4 h-4" /> Approve Variances
              </button>
            </>
          )}

          {stocktake.status === 'REJECTED' && canManage && (
            <button onClick={() => handleAction('start')} disabled={!!actioning} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">
              <Play className="w-4 h-4" /> Resume Counting
            </button>
          )}

          {stocktake.status === 'APPROVED' && canApprove && (
            <button onClick={() => handleAction('post')} disabled={!!actioning} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg">
              <Archive className="w-4 h-4" /> Post to Ledger
            </button>
          )}
        </div>
      </div>

      {/* Review Mode Variance Summary */}
      {isReviewMode && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-red-500">
            <span className="text-slate-500 text-sm font-medium">Total Shortage Value</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stocktake.totalShortageValue || 0)}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-blue-500">
            <span className="text-slate-500 text-sm font-medium">Total Overage Value</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stocktake.totalOverageValue || 0)}</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm border-l-4 border-l-indigo-500">
            <span className="text-slate-500 text-sm font-medium">Net Variance Value</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{formatCurrency(stocktake.netVarianceValue || 0)}</p>
          </div>
        </div>
      )}

      {/* Warning for Posting */}
      {stocktake.status === 'APPROVED' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 mb-8">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <span className="font-semibold block mb-1">Ready to Post</span>
            Click "Post to Ledger" to mathematically apply these variances to the system quantity on hand. This action is irreversible and will create adjustment records.
          </div>
        </div>
      )}

      {/* Items Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" /> Count Sheet
          </h2>
          {isCountingMode && (
            <span className="text-xs font-medium bg-blue-100 text-blue-700 px-2 py-1 rounded">Blind Count Active</span>
          )}
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="px-6 py-3 font-medium">Item</th>
                <th className="px-6 py-3 font-medium">SKU</th>
                <th className="px-6 py-3 font-medium">Unit</th>
                
                {/* Counting mode only shows Physical Count. Review mode shows all. */}
                {!isCountingMode && (
                  <th className="px-6 py-3 font-medium text-right">Expected Qty</th>
                )}
                
                <th className="px-6 py-3 font-medium text-right bg-indigo-50/50">Physical Count</th>
                
                {!isCountingMode && (
                  <>
                    <th className="px-6 py-3 font-medium text-right">Variance</th>
                    <th className="px-6 py-3 font-medium text-right">Variance Value</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stocktake.items.map((item: any) => {
                const variance = item.variance ? parseFloat(item.variance) : 0;
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4 font-medium text-slate-900">{item.stockItem.name}</td>
                    <td className="px-6 py-4 text-slate-500">{item.stockItem.sku || '-'}</td>
                    <td className="px-6 py-4 text-slate-500">{item.stockItem.baseUnit}</td>
                    
                    {!isCountingMode && (
                      <td className="px-6 py-4 text-right text-slate-600 font-medium">
                        {parseFloat(item.expectedQty).toFixed(4)}
                      </td>
                    )}
                    
                    <td className="px-6 py-3 text-right bg-indigo-50/20">
                      {isCountingMode ? (
                        <input
                          type="number"
                          step="0.0001"
                          min="0"
                          value={counts[item.id] || ''}
                          onChange={(e) => setCounts({ ...counts, [item.id]: e.target.value })}
                          className="w-24 text-right px-2 py-1.5 border border-indigo-200 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium bg-white"
                          placeholder="Count..."
                        />
                      ) : (
                        <span className="font-bold text-slate-900">
                          {item.countedQty !== null ? parseFloat(item.countedQty).toFixed(4) : '-'}
                        </span>
                      )}
                    </td>

                    {!isCountingMode && (
                      <>
                        <td className={`px-6 py-4 text-right font-bold ${variance === 0 ? 'text-slate-400' : variance > 0 ? 'text-blue-600' : 'text-red-600'}`}>
                          {variance > 0 ? '+' : ''}{variance.toFixed(4)}
                        </td>
                        <td className={`px-6 py-4 text-right font-medium ${variance === 0 ? 'text-slate-400' : 'text-slate-900'}`}>
                          {formatCurrency(parseFloat(item.varianceValue || '0'))}
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
