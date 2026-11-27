'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import {
  ShoppingBag, TrendingUp, Users, Clock, Zap,
  ArrowUpRight, Store, BarChart3, ChevronRight,
  CheckCircle2, AlertCircle, Loader2,
} from 'lucide-react';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function fmt(amount: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
}

const STATUS_LABEL: Record<string, string> = {
  AWAITING_RESTAURANT: 'New',
  ACCEPTED:            'Accepted',
  PREPARING:           'Preparing',
  READY_FOR_PICKUP:    'Ready',
  OUT_FOR_DELIVERY:    'Delivering',
  DELIVERED:           'Delivered',
  CANCELLED:           'Cancelled',
};

const STATUS_COLOR: Record<string, string> = {
  AWAITING_RESTAURANT: '#f59e0b',
  ACCEPTED:            '#3b82f6',
  PREPARING:           '#8b5cf6',
  READY_FOR_PICKUP:    '#10b981',
  OUT_FOR_DELIVERY:    '#06b6d4',
  DELIVERED:           '#22c55e',
  CANCELLED:           '#ef4444',
};

export function CommerceDashboardClient() {
  const { data: storesData } = useSWR('/api/commerce/manage/stores', fetcher, { refreshInterval: 30000 });
  const stores: any[] = storesData?.data ?? [];
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const storeId = selectedStoreId ?? stores[0]?.id;
  const { data: analyticsData, isLoading } = useSWR(
    storeId ? `/api/commerce/manage/stores/${storeId}/analytics` : null,
    fetcher,
    { refreshInterval: 15000 },
  );
  const analytics = analyticsData?.data;

  if (stores.length === 0 && !storesData) {
    return (
      <div className="commerce-empty-state">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="commerce-empty-state">
        <Store size={48} className="commerce-empty-icon" />
        <h2>No stores yet</h2>
        <p>Create your first Commerce store to start accepting online food orders.</p>
        <Link href="/fnb/commerce/setup" className="commerce-btn commerce-btn--primary">
          Create Store
        </Link>
      </div>
    );
  }

  const revenue = analytics?.revenue;
  const liveOrders: any[] = analytics?.liveOrders ?? [];
  const topProducts: any[] = analytics?.topProducts ?? [];

  return (
    <div className="commerce-dashboard">
      {/* Header */}
      <div className="commerce-page-header">
        <div>
          <h1 className="commerce-page-title">Dashboard</h1>
          <p className="commerce-page-sub">Food Commerce overview</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {stores.length > 1 && (
            <select
              className="commerce-select"
              value={storeId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
            >
              {stores.map((s: any) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <Link href="/fnb/commerce/orders" className="commerce-btn commerce-btn--primary">
            <ShoppingBag size={15} />
            Live Orders
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="commerce-kpi-grid">
        <KpiCard
          label="Today's Revenue"
          value={fmt(revenue?.today ?? 0, analytics?.currency)}
          sub={`${revenue?.todayOrders ?? 0} orders`}
          icon={<TrendingUp size={18} />}
          color="hsl(262 83% 58%)"
          loading={isLoading}
        />
        <KpiCard
          label="This Week"
          value={fmt(revenue?.week ?? 0, analytics?.currency)}
          sub={`${revenue?.weekOrders ?? 0} orders`}
          icon={<BarChart3 size={18} />}
          color="hsl(199 89% 48%)"
          loading={isLoading}
        />
        <KpiCard
          label="This Month"
          value={fmt(revenue?.month ?? 0, analytics?.currency)}
          sub={`${revenue?.monthOrders ?? 0} orders`}
          icon={<Zap size={18} />}
          color="hsl(142 76% 36%)"
          loading={isLoading}
        />
        <KpiCard
          label="Live Orders"
          value={String(liveOrders.length)}
          sub="being processed now"
          icon={<Clock size={18} />}
          color="hsl(37 91% 55%)"
          loading={isLoading}
          pulse={liveOrders.length > 0}
        />
      </div>

      <div className="commerce-dashboard-grid">
        {/* Live orders */}
        <section className="commerce-card">
          <div className="commerce-card__header">
            <h2 className="commerce-card__title">Live Orders</h2>
            <Link href="/fnb/commerce/orders" className="commerce-link">
              View all <ChevronRight size={14} />
            </Link>
          </div>
          {liveOrders.length === 0 ? (
            <div className="commerce-card__empty">
              <CheckCircle2 size={28} className="commerce-card__empty-icon" />
              <p>All caught up — no active orders</p>
            </div>
          ) : (
            <div className="commerce-order-list">
              {liveOrders.slice(0, 6).map((order: any) => (
                <div key={order.id} className="commerce-order-row">
                  <div>
                    <p className="commerce-order-ref">{order.orderRef}</p>
                    <p className="commerce-order-customer">{order.customer?.name ?? 'Guest'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      className="commerce-status-badge"
                      style={{ background: `${STATUS_COLOR[order.status]}20`, color: STATUS_COLOR[order.status] }}
                    >
                      {STATUS_LABEL[order.status] ?? order.status}
                    </span>
                    <p className="commerce-order-time">
                      {new Date(order.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Top products */}
        <section className="commerce-card">
          <div className="commerce-card__header">
            <h2 className="commerce-card__title">Top Products</h2>
            <Link href="/fnb/commerce/analytics" className="commerce-link">
              Full report <ChevronRight size={14} />
            </Link>
          </div>
          {topProducts.length === 0 ? (
            <div className="commerce-card__empty">
              <AlertCircle size={28} className="commerce-card__empty-icon" />
              <p>No sales data yet</p>
            </div>
          ) : (
            <div className="commerce-top-products">
              {topProducts.map((p: any, i: number) => (
                <div key={p.product.id} className="commerce-top-product-row">
                  <span className="commerce-rank">#{i + 1}</span>
                  <div className="commerce-top-product-info">
                    <p className="commerce-top-product-name">{p.product.name}</p>
                    <p className="commerce-top-product-price">{fmt(p.product.price ?? 0, analytics?.currency)}</p>
                  </div>
                  <div className="commerce-top-product-qty">
                    <span>{p.quantitySold}</span>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>sold</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Quick links */}
        <section className="commerce-card">
          <div className="commerce-card__header">
            <h2 className="commerce-card__title">Quick Actions</h2>
          </div>
          <div className="commerce-quick-actions">
            {[
              { label: 'Add Product',   href: '/fnb/commerce/menu',         icon: '🍽️' },
              { label: 'Manage Menu',   href: '/fnb/commerce/menu',         icon: '📋' },
              { label: 'View Customers',href: '/fnb/commerce/customers',    icon: '👥' },
              { label: 'Create Promo',  href: '/fnb/commerce/promotions',   icon: '🏷️' },
              { label: 'Store Settings',href: '/fnb/commerce/setup',        icon: '⚙️' },
              { label: 'Get Embed Code',href: '/fnb/commerce/integrations', icon: '🔗' },
            ].map((a) => (
              <Link key={a.href + a.label} href={a.href} className="commerce-quick-action-item">
                <span className="commerce-quick-action-emoji">{a.icon}</span>
                <span>{a.label}</span>
                <ArrowUpRight size={14} style={{ marginLeft: 'auto', opacity: 0.4 }} />
              </Link>
            ))}
          </div>
        </section>
      </div>

      <style>{`
        .commerce-dashboard { display: flex; flex-direction: column; gap: 24px; }
        .commerce-page-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          flex-wrap: wrap; gap: 12px;
        }
        .commerce-page-title { font-size: 22px; font-weight: 700; color: hsl(222 47% 11%); margin: 0; }
        .commerce-page-sub { font-size: 13px; color: #6b7280; margin: 2px 0 0; }

        .commerce-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .commerce-dashboard-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 900px) { .commerce-dashboard-grid { grid-template-columns: 1fr; } }

        /* KPI Card */
        .kpi-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          border: 1px solid #e5e7eb;
          position: relative;
          overflow: hidden;
        }
        .kpi-card__icon-wrap {
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          color: white; margin-bottom: 12px;
        }
        .kpi-card__value { font-size: 22px; font-weight: 700; color: hsl(222 47% 11%); margin: 0 0 2px; }
        .kpi-card__label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; margin: 0 0 4px; }
        .kpi-card__sub { font-size: 12px; color: #6b7280; margin: 0; }
        .kpi-card__pulse { position: absolute; top: 16px; right: 16px; width: 8px; height: 8px; border-radius: 50%; background: #22c55e; animation: pulse-ring 1.5s infinite; }
        @keyframes pulse-ring { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.5; transform: scale(1.4); } }

        /* Card */
        .commerce-card {
          background: white; border-radius: 12px; border: 1px solid #e5e7eb;
          padding: 20px; display: flex; flex-direction: column; gap: 16px;
        }
        .commerce-card__header { display: flex; justify-content: space-between; align-items: center; }
        .commerce-card__title { font-size: 15px; font-weight: 600; color: hsl(222 47% 11%); margin: 0; }
        .commerce-link { display: flex; align-items: center; gap: 2px; font-size: 12px; color: hsl(262 83% 58%); text-decoration: none; }
        .commerce-link:hover { text-decoration: underline; }
        .commerce-card__empty { text-align: center; padding: 24px; color: #9ca3af; font-size: 13px; }
        .commerce-card__empty-icon { display: block; margin: 0 auto 8px; opacity: 0.4; }

        /* Order list */
        .commerce-order-list { display: flex; flex-direction: column; gap: 2px; }
        .commerce-order-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 10px 12px; border-radius: 8px; background: #f9fafb;
        }
        .commerce-order-ref { font-size: 13px; font-weight: 600; color: hsl(222 47% 11%); margin: 0; }
        .commerce-order-customer { font-size: 12px; color: #6b7280; margin: 2px 0 0; }
        .commerce-order-time { font-size: 11px; color: #9ca3af; margin: 2px 0 0; }
        .commerce-status-badge {
          display: inline-block; padding: 2px 8px; border-radius: 999px;
          font-size: 11px; font-weight: 600;
        }

        /* Top products */
        .commerce-top-products { display: flex; flex-direction: column; gap: 8px; }
        .commerce-top-product-row {
          display: flex; align-items: center; gap: 12px;
          padding: 8px 10px; border-radius: 8px; background: #f9fafb;
        }
        .commerce-rank { font-size: 11px; font-weight: 700; color: #9ca3af; width: 20px; }
        .commerce-top-product-info { flex: 1; }
        .commerce-top-product-name { font-size: 13px; font-weight: 500; color: hsl(222 47% 11%); margin: 0; }
        .commerce-top-product-price { font-size: 11px; color: #6b7280; margin: 2px 0 0; }
        .commerce-top-product-qty { display: flex; flex-direction: column; align-items: center; min-width: 32px; font-size: 14px; font-weight: 700; color: hsl(262 83% 58%); }

        /* Quick actions */
        .commerce-quick-actions { display: flex; flex-direction: column; gap: 4px; }
        .commerce-quick-action-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 8px; text-decoration: none;
          font-size: 13px; color: hsl(222 47% 20%);
          transition: background 0.15s;
        }
        .commerce-quick-action-item:hover { background: hsl(262 83% 97%); color: hsl(262 83% 45%); }
        .commerce-quick-action-emoji { font-size: 16px; width: 24px; text-align: center; }

        /* Shared */
        .commerce-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 500;
          text-decoration: none; border: none; cursor: pointer; transition: opacity 0.15s;
        }
        .commerce-btn--primary { background: hsl(262 83% 58%); color: white; }
        .commerce-btn--primary:hover { opacity: 0.9; }
        .commerce-select {
          padding: 7px 12px; border-radius: 8px; border: 1px solid #d1d5db;
          font-size: 13px; background: white; color: hsl(222 47% 11%); cursor: pointer;
        }
        .commerce-empty-state {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 60vh; gap: 16px; text-align: center; color: #6b7280;
        }
        .commerce-empty-state h2 { font-size: 20px; font-weight: 600; color: hsl(222 47% 11%); margin: 0; }
        .commerce-empty-state p { font-size: 14px; max-width: 360px; margin: 0; }
        .commerce-empty-icon { opacity: 0.3; }
      `}</style>
    </div>
  );
}

function KpiCard({ label, value, sub, icon, color, loading, pulse }: {
  label: string; value: string; sub: string;
  icon: React.ReactNode; color: string;
  loading?: boolean; pulse?: boolean;
}) {
  return (
    <div className="kpi-card">
      {pulse && <span className="kpi-card__pulse" />}
      <div className="kpi-card__icon-wrap" style={{ background: color }}>{icon}</div>
      <p className="kpi-card__label">{label}</p>
      <p className="kpi-card__value">{loading ? '—' : value}</p>
      <p className="kpi-card__sub">{sub}</p>
    </div>
  );
}
