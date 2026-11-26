'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { trackOrder } from '@/lib/commerce';
import type { OrderTrackStatus } from '@/lib/commerce';

const STATUS_STEPS = [
  { key: 'AWAITING_RESTAURANT', label: 'Order Received',    icon: '📋' },
  { key: 'ACCEPTED',            label: 'Accepted',          icon: '✅' },
  { key: 'PREPARING',           label: 'Being Prepared',    icon: '👨‍🍳' },
  { key: 'READY',               label: 'Ready',             icon: '🔔' },
  { key: 'DELIVERING',          label: 'On the Way',        icon: '🚗' },
  { key: 'DELIVERED',           label: 'Delivered',         icon: '🎉' },
];

const PICKUP_STEPS = STATUS_STEPS.filter(s => s.key !== 'DELIVERING');

function fmt(amount: number, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);
}

function getStepIndex(status: string, orderType: string): number {
  const steps = orderType === 'PICKUP' ? PICKUP_STEPS : STATUS_STEPS;
  const idx = steps.findIndex(s => s.key === status);
  return idx === -1 ? 0 : idx;
}

export function OrderTrackClient({ orderRef }: { orderRef: string }) {
  const [order, setOrder] = useState<OrderTrackStatus | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Read token from query params (Paystack redirects with ?token=...)
  const token = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('token') ?? sessionStorage.getItem('stanzel-order-token') ?? ''
    : '';

  async function fetchStatus() {
    try {
      const data = await trackOrder(orderRef, token);
      setOrder(data);
      setError('');
      // Stop polling once delivered/cancelled
      if (['DELIVERED', 'CANCELLED', 'REJECTED'].includes(data.status)) {
        if (intervalRef.current) clearInterval(intervalRef.current);
      }
    } catch (err: any) {
      setError(err.message ?? 'Could not load order status');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchStatus();
    // Poll every 15 seconds
    intervalRef.current = setInterval(fetchStatus, 15_000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [orderRef, token]);

  const steps = order?.orderType === 'PICKUP' ? PICKUP_STEPS : STATUS_STEPS;
  const activeIdx = order ? getStepIndex(order.status, order.orderType) : 0;

  if (loading) return (
    <div className="track-loading">
      <div className="track-spinner" />
      <p>Loading your order…</p>
    </div>
  );

  if (error) return (
    <div className="track-error">
      <p className="track-error__msg">⚠️ {error}</p>
      <Link href="/dining" className="btn btn-primary">Back to Menu</Link>
    </div>
  );

  if (!order) return null;

  return (
    <div className="track-page">
      <div className="container track-container">
        {/* Header */}
        <div className="track-header">
          <p className="eyebrow" style={{ color: 'var(--color-gold)' }}>Order Tracking</p>
          <h1 className="track-title">{order.orderRef}</h1>
          <p className="track-sub">
            {order.orderType === 'DELIVERY' ? '🚗 Delivery' : '🏃 Pickup'} ·{' '}
            {new Date(order.createdAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {order.estimatedReadyAt && (
            <p className="track-eta">
              Estimated ready: <strong>{new Date(order.estimatedReadyAt).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}</strong>
            </p>
          )}
        </div>

        {/* Status timeline */}
        <div className="track-card">
          <div className="timeline">
            {steps.map((s, i) => (
              <div key={s.key} className={`timeline-step${i <= activeIdx ? ' done' : ''}${i === activeIdx ? ' active' : ''}`}>
                <div className="timeline-step__dot">
                  {i <= activeIdx ? <span className="timeline-step__icon">{s.icon}</span> : <span className="timeline-step__num">{i + 1}</span>}
                </div>
                {i < steps.length - 1 && <div className={`timeline-line${i < activeIdx ? ' done' : ''}`} />}
                <span className="timeline-step__label">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Order items */}
        <div className="track-card track-items-card">
          <h2 className="track-card__title">Items Ordered</h2>
          {order.items.map((item, i) => (
            <div key={i} className="track-item">
              <span className="track-item__qty">{item.quantity}×</span>
              <span className="track-item__name">{item.productName}</span>
              <span className="track-item__price">{fmt(item.unitPrice * item.quantity, order.currency)}</span>
            </div>
          ))}
          <div className="track-summary">
            <div className="track-summary__row"><span>Subtotal</span><span>{fmt(order.subtotal, order.currency)}</span></div>
            {order.deliveryFee > 0 && <div className="track-summary__row"><span>Delivery</span><span>{fmt(order.deliveryFee, order.currency)}</span></div>}
            {order.discount > 0 && <div className="track-summary__row discount"><span>Discount</span><span>−{fmt(order.discount, order.currency)}</span></div>}
            <div className="track-summary__row total"><span>Total Paid</span><span>{fmt(order.total, order.currency)}</span></div>
          </div>
        </div>

        <div className="track-actions">
          <Link href="/dining" className="btn btn-secondary">Order Again</Link>
        </div>
      </div>

      <style>{`
        .track-page { background: var(--bg); min-height: 100vh; padding: var(--space-12) 0 var(--space-20); }
        .track-container { max-width: 680px; }

        .track-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: var(--space-4); color: var(--color-muted); }
        .track-spinner { width: 40px; height: 40px; border: 3px solid var(--color-border); border-top-color: var(--color-green); border-radius: 50%; animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .track-error { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: var(--space-4); }
        .track-error__msg { color: #dc2626; font-size: var(--text-lg); }

        .track-header { margin-bottom: var(--space-8); }
        .track-title { font-family: var(--font-serif); font-size: var(--text-4xl); color: var(--color-green); margin-bottom: var(--space-2); }
        .track-sub { color: var(--color-muted); margin-bottom: var(--space-2); }
        .track-eta { font-size: var(--text-sm); color: var(--color-green); background: rgba(26,60,52,0.08); padding: 8px 14px; border-radius: var(--radius-lg); display: inline-block; }

        .track-card { background: white; border: 1px solid var(--color-border); border-radius: var(--radius-2xl); padding: var(--space-8); margin-bottom: var(--space-6); }
        .track-card__title { font-family: var(--font-serif); font-size: var(--text-xl); color: var(--color-green); margin-bottom: var(--space-5); }

        /* Timeline */
        .timeline { display: flex; align-items: flex-start; gap: 0; }
        .timeline-step { display: flex; flex-direction: column; align-items: center; gap: var(--space-2); flex: 1; position: relative; }
        .timeline-step__dot { width: 44px; height: 44px; border-radius: 50%; border: 2px solid var(--color-border); background: white; display: flex; align-items: center; justify-content: center; z-index: 1; transition: all 0.3s; }
        .timeline-step.done .timeline-step__dot { border-color: var(--color-green); background: var(--color-green); }
        .timeline-step.active .timeline-step__dot { border-color: var(--color-gold); background: var(--color-gold); box-shadow: 0 0 0 4px rgba(201,169,110,0.25); }
        .timeline-step__icon { font-size: 1.1rem; }
        .timeline-step__num { font-size: var(--text-xs); font-weight: 700; color: var(--color-muted); }
        .timeline-step__label { font-size: 0.65rem; font-weight: 600; color: var(--color-muted); text-align: center; line-height: 1.3; max-width: 60px; }
        .timeline-step.done .timeline-step__label, .timeline-step.active .timeline-step__label { color: var(--color-green); }
        .timeline-line { position: absolute; top: 22px; left: calc(50% + 22px); width: calc(100% - 44px); height: 2px; background: var(--color-border); z-index: 0; }
        .timeline-line.done { background: var(--color-green); }

        /* Items */
        .track-items-card {}
        .track-item { display: flex; align-items: baseline; gap: var(--space-3); padding: var(--space-2) 0; border-bottom: 1px solid var(--color-border); }
        .track-item:last-of-type { border-bottom: none; }
        .track-item__qty { font-weight: 700; color: var(--color-green); min-width: 24px; font-size: var(--text-sm); }
        .track-item__name { flex: 1; font-size: var(--text-sm); }
        .track-item__price { font-size: var(--text-sm); font-weight: 600; white-space: nowrap; }

        .track-summary { margin-top: var(--space-4); padding-top: var(--space-4); border-top: 1px solid var(--color-border); display: flex; flex-direction: column; gap: var(--space-2); }
        .track-summary__row { display: flex; justify-content: space-between; font-size: var(--text-sm); color: var(--color-muted); }
        .track-summary__row.discount { color: #059669; }
        .track-summary__row.total { font-size: var(--text-base); font-weight: 800; color: var(--color-green); border-top: 1px solid var(--color-border); padding-top: var(--space-3); margin-top: var(--space-2); }

        .track-actions { display: flex; gap: var(--space-4); flex-wrap: wrap; }
      `}</style>
    </div>
  );
}
