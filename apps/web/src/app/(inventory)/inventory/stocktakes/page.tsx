'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ClipboardList, Plus, Search, Filter } from 'lucide-react';
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

export default function StocktakesPage() {
  const [stocktakes, setStocktakes] = useState<Stocktake[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/v1/inventory/stocktakes')
      .then(res => res.json())
      .then(data => {
        setStocktakes(data.data || []);
        setLoading(false);
      });
  }, []);

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-700',
      COUNTING: 'bg-blue-100 text-blue-700',
      SUBMITTED: 'bg-amber-100 text-amber-700',
      REJECTED: 'bg-red-100 text-red-700',
      APPROVED: 'bg-indigo-100 text-indigo-700',
      COMPLETED: 'bg-green-100 text-green-700',
      CANCELLED: 'bg-slate-200 text-slate-500',
    };
    return (
      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${colors[status] || colors.DRAFT}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <ClipboardList className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Stocktakes</h1>
            <p className="text-slate-500 text-sm mt-0.5">Manage batch physical inventory counts</p>
          </div>
        </div>

        <Link
          href="/inventory/stocktakes/new"
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Stocktake
        </Link>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-200 flex gap-4 bg-slate-50">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search stocktakes..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 bg-white">
            <Filter className="w-4 h-4" /> Filter
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <th className="px-6 py-3 font-medium">Reference</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Warehouse</th>
                <th className="px-6 py-3 font-medium">Category</th>
                <th className="px-6 py-3 font-medium text-right">Items</th>
                <th className="px-6 py-3 font-medium text-right">Created</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">Loading stocktakes...</td>
                </tr>
              ) : stocktakes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <ClipboardList className="w-12 h-12 text-slate-300 mb-3" />
                      <p className="text-slate-900 font-medium mb-1">No stocktakes found</p>
                      <p className="text-sm">Create a new stocktake to begin physical counting.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                stocktakes.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-indigo-600">
                      <Link href={`/inventory/stocktakes/${st.id}`}>{st.stocktakeRef}</Link>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(st.status)}</td>
                    <td className="px-6 py-4 text-slate-700">{st.warehouse.name}</td>
                    <td className="px-6 py-4 text-slate-700">{st.category?.name || 'All'}</td>
                    <td className="px-6 py-4 text-right text-slate-900 font-medium">{st._count.items}</td>
                    <td className="px-6 py-4 text-right text-slate-500">
                      {format(new Date(st.createdAt), 'MMM d, yyyy')}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link 
                        href={`/inventory/stocktakes/${st.id}`}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
