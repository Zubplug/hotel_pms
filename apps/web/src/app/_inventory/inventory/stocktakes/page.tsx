'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Plus, ArrowRight } from 'lucide-react';
import { format } from 'date-fns';

interface Stocktake {
  id: string;
  stocktakeRef: string;
  status: string;
  warehouse: { name: string };
  category?: { name: string };
  _count: { items: number };
  createdAt: string;
}

const STATUS_META: Record<string, { label: string; classes: string }> = {
  DRAFT:     { label: 'Draft',     classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  COUNTING:  { label: 'Counting',  classes: 'bg-blue-50 text-blue-700 border-blue-200' },
  SUBMITTED: { label: 'Submitted', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  REJECTED:  { label: 'Rejected',  classes: 'bg-red-50 text-red-700 border-red-200' },
  APPROVED:  { label: 'Approved',  classes: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  COMPLETED: { label: 'Completed', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CANCELLED: { label: 'Cancelled', classes: 'bg-slate-100 text-slate-500 border-slate-200' },
};

export default function StocktakesPage() {
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/inventory/stocktakes')
      .then((res) => res.json())
      .then((data) => {
        setStocktakes(data.data || []);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#0f2619] px-8 py-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Stocktakes</h1>
            <p className="text-slate-400 text-sm mt-1">Manage batch physical inventory counts and reconcile variances.</p>
          </div>
          <Link
            href="/inventory/stocktakes/new"
            className="inline-flex items-center gap-2 bg-white text-slate-800 border border-white/20 hover:bg-white/90 px-4 py-2 rounded-lg text-sm font-semibold shadow-sm self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            New Stocktake
          </Link>
        </div>
      </div>

      <div className="px-6 py-7 max-w-screen-xl mx-auto">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <ClipboardList className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-700">All Stocktakes</span>
            {!loading && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                {stocktakes.length}
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 rounded-full border-[3px] border-emerald-500 border-t-transparent animate-spin" />
                <p className="text-sm text-slate-400">Loading stocktakes…</p>
              </div>
            </div>
          ) : stocktakes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <ClipboardList className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No stocktakes yet</p>
              <p className="text-sm text-slate-400 mt-1">Create a new stocktake to begin physical counting.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {['Reference', 'Status', 'Warehouse', 'Category', 'Items', 'Created', ''].map(
                      (h, i) => (
                        <th
                          key={i}
                          className={`px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap ${
                            i >= 4 ? 'text-right' : 'text-left'
                          }`}
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stocktakes.map((st) => {
                    const meta = STATUS_META[st.status] ?? STATUS_META.DRAFT;
                    return (
                      <tr key={st.id} className="hover:bg-slate-50/70 transition-colors group">
                        <td className="px-6 py-4">
                          <Link
                            href={`/inventory/stocktakes/${st.id}`}
                            className="font-mono font-bold text-indigo-700 hover:text-indigo-900 text-xs"
                          >
                            {st.stocktakeRef}
                          </Link>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.classes}`}>
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-700">{st.warehouse.name}</td>
                        <td className="px-6 py-4 text-slate-600">{st.category?.name || 'All Categories'}</td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
                            {st._count.items}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">
                          {format(new Date(st.createdAt), 'dd MMM yyyy')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/inventory/stocktakes/${st.id}`}
                            className="inline-flex items-center gap-1 opacity-0 group-hover:opacity-100 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-all"
                          >
                            Open <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
