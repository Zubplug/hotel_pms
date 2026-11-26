'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Clock, ChevronRight, Loader2, RefreshCw } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const COLUMNS = [
  { key: 'AWAITING_RESTAURANT', label: 'New Orders',  color: '#f59e0b', bg: '#fffbeb' },
  { key: 'ACCEPTED',            label: 'Accepted',    color: '#3b82f6', bg: '#eff6ff' },
  { key: 'PREPARING',           label: 'Preparing',   color: '#8b5cf6', bg: '#f5f3ff' },
  { key: 'READY_FOR_PICKUP',    label: 'Ready',       color: '#10b981', bg: '#ecfdf5' },
  { key: 'OUT_FOR_DELIVERY',    label: 'Delivering',  color: '#06b6d4', bg: '#ecfeff' },
];

const NEXT_STATUS: Record<string, string> = {
  AWAITING_RESTAURANT: 'ACCEPTED',
  ACCEPTED:            'PREPARING',
  PREPARING:           'READY_FOR_PICKUP',
  READY_FOR_PICKUP:    'DELIVERED',
  OUT_FOR_DELIVERY:    'DELIVERED',
};

function minutesAgo(date: string) {
  const diff = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (diff < 1) return 'just now';
  if (diff === 1) return '1 min ago';
  return `${diff} min ago`;
}

export function CommerceOrdersClient() {
  const { data: storesData } = useSWR('/api/commerce/manage/stores', fetcher);
  const stores: any[] = storesData?.data ?? [];
  const [storeId, setStoreId] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const activeStoreId = storeId ?? stores[0]?.id;
  const { data, isLoading, mutate } = useSWR(
    activeStoreId ? `/api/commerce/manage/stores/${activeStoreId}/orders?pageSize=100` : null,
    fetcher,
    { refreshInterval: 10000 },
  );

  const orders: any[] = data?.data ?? [];
  const liveOrders = orders.filter((o) => COLUMNS.some((c) => c.key === o.status));

  async function advanceOrder(orderId: string, nextStatus: string) {
    if (!activeStoreId) return;
    setUpdating(orderId);
    try {
      await fetch(`/api/commerce/manage/stores/${activeStoreId}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      await mutate();
    } finally {
      setUpdating(null);
    }
  }

  async function cancelOrder(orderId: string) {
    if (!activeStoreId || !confirm('Cancel this order?')) return;
    setUpdating(orderId);
    try {
      await fetch(`/api/commerce/manage/stores/${activeStoreId}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      await mutate();
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="orders-page">
      <div className="orders-header">
        <div>
          <h1 className="orders-title">Live Orders</h1>
          <p className="orders-sub">Auto-refreshes every 10 seconds</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {stores.length > 1 && (
            <select className="commerce-select" value={activeStoreId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button className="orders-refresh-btn" onClick={() => mutate()}>
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="orders-loading"><Loader2 className="animate-spin" size={28} /></div>
      ) : (
        <div className="orders-kanban">
          {COLUMNS.map((col) => {
            const colOrders = liveOrders.filter((o) => o.status === col.key);
            return (
              <div key={col.key} className="orders-column">
                <div className="orders-column__header" style={{ borderColor: col.color }}>
                  <span className="orders-column__label" style={{ color: col.color }}>{col.label}</span>
                  <span className="orders-column__count" style={{ background: col.color }}>{colOrders.length}</span>
                </div>
                <div className="orders-column__list">
                  {colOrders.length === 0 && (
                    <div className="orders-empty-col">Empty</div>
                  )}
                  {colOrders.map((order: any) => {
                    const isUpdating = updating === order.id;
                    const nextStatus = NEXT_STATUS[order.status];
                    const totalItems = order.items?.reduce((s: number, i: any) => s + i.quantity, 0) ?? 0;
                    return (
                      <div key={order.id} className="order-card" style={{ background: col.bg }}>
                        <div className="order-card__top">
                          <span className="order-card__ref">{order.orderRef}</span>
                          <span className="order-card__time">
                            <Clock size={11} /> {minutesAgo(order.createdAt)}
                          </span>
                        </div>
                        <p className="order-card__customer">{order.customer?.name ?? 'Guest'}</p>
                        <p className="order-card__phone">{order.customer?.phone}</p>
                        <div className="order-card__items">
                          {order.items?.slice(0, 3).map((item: any) => (
                            <span key={item.id} className="order-card__item-pill">
                              {item.quantity}× {item.product?.name ?? item.productName}
                            </span>
                          ))}
                          {totalItems > 3 && <span className="order-card__item-pill">+{totalItems - 3} more</span>}
                        </div>
                        <div className="order-card__type-row">
                          <span className="order-card__type">{order.orderType}</span>
                          <span className="order-card__total">
                            ₦{Number(order.totalAmount).toLocaleString()}
                          </span>
                        </div>
                        <div className="order-card__actions">
                          {nextStatus && (
                            <button
                              className="order-card__btn order-card__btn--advance"
                              style={{ background: col.color }}
                              onClick={() => advanceOrder(order.id, nextStatus)}
                              disabled={isUpdating}
                            >
                              {isUpdating ? <Loader2 size={12} className="animate-spin" /> : <ChevronRight size={12} />}
                              {nextStatus === 'DELIVERED' ? 'Mark Delivered' : `Mark ${NEXT_STATUS[order.status]?.replace(/_/g,' ')}`}
                            </button>
                          )}
                          <button
                            className="order-card__btn order-card__btn--cancel"
                            onClick={() => cancelOrder(order.id)}
                            disabled={isUpdating}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .orders-page { display: flex; flex-direction: column; gap: 20px; height: 100%; }
        .orders-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          flex-wrap: wrap; gap: 12px;
        }
        .orders-title { font-size: 22px; font-weight: 700; color: hsl(222 47% 11%); margin: 0; }
        .orders-sub { font-size: 12px; color: #9ca3af; margin: 2px 0 0; }
        .orders-refresh-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 7px 12px; border-radius: 8px; border: 1px solid #d1d5db;
          background: white; font-size: 13px; cursor: pointer; color: #374151;
          transition: background 0.15s;
        }
        .orders-refresh-btn:hover { background: #f3f4f6; }
        .orders-loading {
          display: flex; align-items: center; justify-content: center;
          min-height: 300px; color: #9ca3af;
        }
        .orders-kanban {
          display: grid;
          grid-template-columns: repeat(5, minmax(220px, 1fr));
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 16px;
          min-height: 70vh;
          align-items: start;
        }
        @media (max-width: 1200px) { .orders-kanban { grid-template-columns: repeat(3, minmax(200px, 1fr)); } }
        @media (max-width: 700px) { .orders-kanban { grid-template-columns: repeat(2, minmax(180px, 1fr)); } }

        .orders-column {
          background: white; border-radius: 12px; border: 1px solid #e5e7eb;
          display: flex; flex-direction: column; overflow: hidden;
        }
        .orders-column__header {
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 14px; border-bottom: 2px solid;
        }
        .orders-column__label { font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; }
        .orders-column__count {
          font-size: 11px; font-weight: 700; color: white;
          padding: 2px 7px; border-radius: 999px;
        }
        .orders-column__list { flex: 1; padding: 10px; display: flex; flex-direction: column; gap: 8px; overflow-y: auto; max-height: 70vh; }
        .orders-empty-col { text-align: center; color: #d1d5db; font-size: 12px; padding: 20px; }

        /* Order card */
        .order-card { border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 6px; border: 1px solid rgba(0,0,0,0.05); }
        .order-card__top { display: flex; justify-content: space-between; align-items: center; }
        .order-card__ref { font-size: 12px; font-weight: 700; color: hsl(222 47% 11%); }
        .order-card__time { font-size: 10px; color: #9ca3af; display: flex; align-items: center; gap: 3px; }
        .order-card__customer { font-size: 13px; font-weight: 600; color: hsl(222 47% 15%); margin: 0; }
        .order-card__phone { font-size: 11px; color: #6b7280; margin: 0; }
        .order-card__items { display: flex; flex-wrap: wrap; gap: 4px; }
        .order-card__item-pill {
          font-size: 10px; padding: 2px 6px; border-radius: 999px;
          background: rgba(0,0,0,0.06); color: #374151; white-space: nowrap;
        }
        .order-card__type-row { display: flex; justify-content: space-between; align-items: center; }
        .order-card__type { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #9ca3af; }
        .order-card__total { font-size: 13px; font-weight: 700; color: hsl(222 47% 11%); }
        .order-card__actions { display: flex; gap: 6px; padding-top: 4px; }
        .order-card__btn {
          flex: 1; display: flex; align-items: center; justify-content: center; gap: 4px;
          padding: 6px 8px; border-radius: 7px; border: none; cursor: pointer;
          font-size: 11px; font-weight: 600; transition: opacity 0.15s;
        }
        .order-card__btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .order-card__btn--advance { color: white; }
        .order-card__btn--advance:hover:not(:disabled) { opacity: 0.85; }
        .order-card__btn--cancel {
          background: rgba(239,68,68,0.1); color: #ef4444; flex: 0 0 auto;
        }
        .order-card__btn--cancel:hover:not(:disabled) { background: rgba(239,68,68,0.2); }
        .commerce-select {
          padding: 7px 12px; border-radius: 8px; border: 1px solid #d1d5db;
          font-size: 13px; background: white; color: hsl(222 47% 11%); cursor: pointer;
        }
      `}</style>
    </div>
  );
}
