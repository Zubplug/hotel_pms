'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { BarChart3, TrendingUp, ShoppingBag, Users, Loader2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function fmt(n: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(n);
}

const CHANNEL_ICONS: Record<string, string> = { DELIVERY: '🛵', PICKUP: '🏪', DINE_IN: '🍽️' };

export function CommerceAnalyticsClient() {
  const { data: storesData } = useSWR('/api/commerce/manage/stores', fetcher);
  const stores: any[] = storesData?.data ?? [];
  const [storeId, setStoreId] = useState<string | null>(null);
  const activeStoreId = storeId ?? stores[0]?.id;

  const { data, isLoading } = useSWR(
    activeStoreId ? `/api/commerce/manage/stores/${activeStoreId}/analytics` : null,
    fetcher, { refreshInterval: 60000 },
  );
  const a = data?.data;
  const currency = a?.currency ?? 'NGN';

  const statusCounts: Record<string, number> = a?.statusCounts ?? {};
  const channelBreakdown: any[] = a?.channelBreakdown ?? [];
  const topProducts: any[] = a?.topProducts ?? [];

  const totalOrders = Object.values(statusCounts).reduce((s, v) => s + (v as number), 0);
  const completedOrders = (statusCounts['DELIVERED'] ?? 0) + (statusCounts['READY_FOR_PICKUP'] ?? 0);

  return (
    <div className="analytics-page">
      <div className="analytics-header">
        <div>
          <h1 className="analytics-title">Analytics</h1>
          <p className="analytics-sub">Revenue, orders and product performance</p>
        </div>
        {stores.length > 1 && (
          <select className="commerce-select" value={activeStoreId} onChange={(e) => setStoreId(e.target.value)}>
            {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="analytics-loading"><Loader2 className="animate-spin" size={28} /></div>
      ) : (
        <>
          {/* Revenue cards */}
          <div className="analytics-kpi-grid">
            <ACard icon="📅" label="Today" value={fmt(a?.revenue?.today ?? 0, currency)} sub={`${a?.revenue?.todayOrders ?? 0} orders`} />
            <ACard icon="📆" label="This Week" value={fmt(a?.revenue?.week ?? 0, currency)} sub={`${a?.revenue?.weekOrders ?? 0} orders`} />
            <ACard icon="🗓️" label="This Month" value={fmt(a?.revenue?.month ?? 0, currency)} sub={`${a?.revenue?.monthOrders ?? 0} orders`} />
            <ACard icon="✅" label="Completed" value={String(completedOrders)} sub={`of ${totalOrders} total`} />
          </div>

          <div className="analytics-grid">
            {/* Channel breakdown */}
            <section className="analytics-card">
              <h2 className="analytics-card__title">
                <ShoppingBag size={15} /> Orders by Channel
              </h2>
              {channelBreakdown.length === 0 ? (
                <p className="analytics-empty">No orders yet this month</p>
              ) : (
                <div className="analytics-channels">
                  {channelBreakdown.map((ch: any) => {
                    const pct = totalOrders > 0 ? Math.round((ch.count / totalOrders) * 100) : 0;
                    return (
                      <div key={ch.channel} className="analytics-channel-row">
                        <span className="analytics-channel-icon">{CHANNEL_ICONS[ch.channel] ?? '📦'}</span>
                        <div className="analytics-channel-info">
                          <div className="analytics-channel-label-row">
                            <span className="analytics-channel-name">{ch.channel.replace(/_/g, ' ')}</span>
                            <span className="analytics-channel-pct">{pct}%</span>
                          </div>
                          <div className="analytics-bar-track">
                            <div className="analytics-bar-fill" style={{ width: `${pct}%` }} />
                          </div>
                          <div className="analytics-channel-stats">
                            <span>{ch.count} orders</span>
                            <span>{fmt(ch.revenue, currency)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Order status distribution */}
            <section className="analytics-card">
              <h2 className="analytics-card__title">
                <BarChart3 size={15} /> Order Status
              </h2>
              <div className="analytics-status-grid">
                {Object.entries(statusCounts).map(([status, count]) => (
                  <div key={status} className="analytics-status-item">
                    <span className="analytics-status-count">{count as number}</span>
                    <span className="analytics-status-label">{status.replace(/_/g, ' ')}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Top products */}
            <section className="analytics-card analytics-card--wide">
              <h2 className="analytics-card__title">
                <TrendingUp size={15} /> Top Selling Products
              </h2>
              {topProducts.length === 0 ? (
                <p className="analytics-empty">No completed orders yet</p>
              ) : (
                <div className="analytics-top-products">
                  {topProducts.map((p: any, i: number) => {
                    const maxQty = topProducts[0]?.quantitySold ?? 1;
                    const pct = Math.round((p.quantitySold / maxQty) * 100);
                    return (
                      <div key={p.product.id} className="analytics-top-product">
                        <span className="analytics-product-rank">#{i + 1}</span>
                        <div className="analytics-product-info">
                          <div className="analytics-product-name-row">
                            <span className="analytics-product-name">{p.product.name}</span>
                            <span className="analytics-product-qty">{p.quantitySold} sold</span>
                          </div>
                          <div className="analytics-bar-track">
                            <div className="analytics-bar-fill analytics-bar-fill--purple" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="analytics-product-revenue">{fmt(p.product.price * p.quantitySold, currency)}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        </>
      )}

      <style>{`
        .analytics-page { display: flex; flex-direction: column; gap: 20px; }
        .analytics-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
        .analytics-title { font-size: 22px; font-weight: 700; color: hsl(222 47% 11%); margin: 0; }
        .analytics-sub { font-size: 13px; color: #6b7280; margin: 2px 0 0; }
        .analytics-loading { display: flex; align-items: center; justify-content: center; min-height: 300px; color: #9ca3af; }
        .analytics-empty { font-size: 13px; color: #9ca3af; text-align: center; padding: 24px; }

        .analytics-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 14px; }
        .analytics-kpi-card { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; }
        .analytics-kpi-icon { font-size: 20px; margin-bottom: 10px; display: block; }
        .analytics-kpi-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; margin: 0 0 4px; }
        .analytics-kpi-value { font-size: 20px; font-weight: 700; color: hsl(222 47% 11%); margin: 0 0 2px; }
        .analytics-kpi-sub { font-size: 12px; color: #6b7280; margin: 0; }

        .analytics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        @media (max-width: 800px) { .analytics-grid { grid-template-columns: 1fr; } }
        .analytics-card { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .analytics-card--wide { grid-column: 1 / -1; }
        .analytics-card__title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 600; color: hsl(222 47% 11%); margin: 0; }

        .analytics-channels { display: flex; flex-direction: column; gap: 14px; }
        .analytics-channel-row { display: flex; gap: 12px; align-items: flex-start; }
        .analytics-channel-icon { font-size: 20px; margin-top: 2px; }
        .analytics-channel-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .analytics-channel-label-row { display: flex; justify-content: space-between; }
        .analytics-channel-name { font-size: 13px; font-weight: 500; color: hsl(222 47% 11%); text-transform: capitalize; }
        .analytics-channel-pct { font-size: 13px; font-weight: 700; color: hsl(262 83% 58%); }
        .analytics-channel-stats { display: flex; justify-content: space-between; font-size: 11px; color: #9ca3af; }
        .analytics-bar-track { height: 6px; background: #f3f4f6; border-radius: 999px; overflow: hidden; }
        .analytics-bar-fill { height: 100%; background: hsl(199 89% 48%); border-radius: 999px; transition: width 0.5s ease; }
        .analytics-bar-fill--purple { background: hsl(262 83% 58%); }

        .analytics-status-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; }
        .analytics-status-item { background: #f9fafb; border-radius: 8px; padding: 12px; text-align: center; }
        .analytics-status-count { display: block; font-size: 20px; font-weight: 700; color: hsl(222 47% 11%); }
        .analytics-status-label { font-size: 10px; color: #9ca3af; text-transform: capitalize; word-break: break-word; }

        .analytics-top-products { display: flex; flex-direction: column; gap: 12px; }
        .analytics-top-product { display: flex; align-items: center; gap: 12px; }
        .analytics-product-rank { font-size: 12px; font-weight: 700; color: #9ca3af; width: 24px; flex-shrink: 0; }
        .analytics-product-info { flex: 1; display: flex; flex-direction: column; gap: 4px; }
        .analytics-product-name-row { display: flex; justify-content: space-between; }
        .analytics-product-name { font-size: 13px; font-weight: 500; color: hsl(222 47% 11%); }
        .analytics-product-qty { font-size: 12px; color: #6b7280; }
        .analytics-product-revenue { font-size: 13px; font-weight: 600; color: hsl(262 83% 50%); white-space: nowrap; }

        .commerce-select { padding: 7px 12px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 13px; background: white; color: hsl(222 47% 11%); cursor: pointer; }
      `}</style>
    </div>
  );
}

function ACard({ icon, label, value, sub }: { icon: string; label: string; value: string; sub: string }) {
  return (
    <div className="analytics-kpi-card">
      <span className="analytics-kpi-icon">{icon}</span>
      <p className="analytics-kpi-label">{label}</p>
      <p className="analytics-kpi-value">{value}</p>
      <p className="analytics-kpi-sub">{sub}</p>
    </div>
  );
}
