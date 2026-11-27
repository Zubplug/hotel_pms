'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Users, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function fmt(n: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

export function CommerceCustomersClient() {
  const { data: storesData } = useSWR('/api/commerce/manage/stores', fetcher);
  const stores: any[] = storesData?.data ?? [];
  const [storeId, setStoreId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const activeStoreId = storeId ?? stores[0]?.id;
  const qs = new URLSearchParams({ page: String(page), pageSize: '25', ...(search ? { q: search } : {}) });

  const { data, isLoading } = useSWR(
    activeStoreId ? `/api/commerce/manage/stores/${activeStoreId}/customers?${qs}` : null,
    fetcher,
  );

  const customers: any[] = data?.data ?? [];
  const meta = data?.meta ?? { total: 0, totalPages: 1 };
  const store = stores.find((s: any) => s.id === activeStoreId);

  return (
    <div className="customers-page">
      <div className="customers-header">
        <div>
          <h1 className="customers-title">Customers</h1>
          <p className="customers-sub">{meta.total} total customers</p>
        </div>
        {stores.length > 1 && (
          <select className="commerce-select" value={activeStoreId} onChange={(e) => { setStoreId(e.target.value); setPage(1); }}>
            {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {/* Search */}
      <div className="customers-search-row">
        <div className="customers-search-box">
          <Search size={15} className="customers-search-icon" />
          <input
            className="customers-search-input"
            placeholder="Search by name, phone or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="customers-loading"><Loader2 className="animate-spin" size={28} /></div>
      ) : customers.length === 0 ? (
        <div className="customers-empty">
          <Users size={40} style={{ opacity: 0.2 }} />
          <p>{search ? 'No customers match your search' : 'No customers yet. Orders placed through your store will appear here.'}</p>
        </div>
      ) : (
        <>
          <div className="customers-table-wrap">
            <table className="customers-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Orders</th>
                  <th>Total Spend</th>
                  <th>Joined</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <div className="customers-name-cell">
                        <div className="customers-avatar">{c.name.charAt(0).toUpperCase()}</div>
                        <span>{c.name}</span>
                      </div>
                    </td>
                    <td>{c.phone}</td>
                    <td>{c.email ?? '—'}</td>
                    <td>{c._count?.orders ?? 0}</td>
                    <td className="customers-spend">{fmt(Number(c.totalSpend), store?.currency ?? 'NGN')}</td>
                    <td>{new Date(c.createdAt).toLocaleDateString('en-NG')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="customers-pagination">
            <span className="customers-pagination__info">
              Page {page} of {meta.totalPages} · {meta.total} customers
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="customers-page-btn" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={15} />
              </button>
              <button className="customers-page-btn" onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))} disabled={page >= meta.totalPages}>
                <ChevronRight size={15} />
              </button>
            </div>
          </div>
        </>
      )}

      <style>{`
        .customers-page { display: flex; flex-direction: column; gap: 20px; }
        .customers-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
        .customers-title { font-size: 22px; font-weight: 700; color: hsl(222 47% 11%); margin: 0; }
        .customers-sub { font-size: 13px; color: #6b7280; margin: 2px 0 0; }
        .customers-loading { display: flex; align-items: center; justify-content: center; min-height: 200px; color: #9ca3af; }
        .customers-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; min-height: 200px; justify-content: center; color: #9ca3af; text-align: center; }

        .customers-search-row { display: flex; }
        .customers-search-box { position: relative; max-width: 400px; width: 100%; }
        .customers-search-icon { position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #9ca3af; }
        .customers-search-input { width: 100%; padding: 8px 12px 8px 32px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 13px; color: hsl(222 47% 11%); background: white; box-sizing: border-box; }
        .customers-search-input:focus { outline: none; border-color: hsl(262 83% 58%); box-shadow: 0 0 0 3px hsl(262 83% 95%); }

        .customers-table-wrap { background: white; border: 1px solid #e5e7eb; border-radius: 12px; overflow: auto; }
        .customers-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .customers-table th { padding: 11px 14px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; border-bottom: 1px solid #e5e7eb; white-space: nowrap; }
        .customers-table td { padding: 12px 14px; color: hsl(222 47% 11%); border-bottom: 1px solid #f3f4f6; }
        .customers-table tr:last-child td { border-bottom: none; }
        .customers-table tr:hover td { background: #f9fafb; }
        .customers-name-cell { display: flex; align-items: center; gap: 10px; }
        .customers-avatar { width: 30px; height: 30px; border-radius: 50%; background: hsl(262 83% 90%); color: hsl(262 83% 45%); display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
        .customers-spend { font-weight: 600; color: hsl(142 76% 36%); }

        .customers-pagination { display: flex; justify-content: space-between; align-items: center; }
        .customers-pagination__info { font-size: 12px; color: #9ca3af; }
        .customers-page-btn { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border-radius: 7px; border: 1px solid #d1d5db; background: white; cursor: pointer; color: #374151; }
        .customers-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .customers-page-btn:hover:not(:disabled) { background: #f3f4f6; }

        .commerce-select { padding: 7px 12px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 13px; background: white; color: hsl(222 47% 11%); cursor: pointer; }
      `}</style>
    </div>
  );
}
