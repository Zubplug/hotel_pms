'use client';

import React, { useMemo, useState } from 'react';
import useSWR from 'swr';
import { CheckCircle2, Clock3, Loader2, MapPin, PackageCheck, RefreshCw, Send, Truck, XCircle } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((response) => response.json());

const LANES = [
  { key: 'AWAITING_RESTAURANT', label: 'New', tone: 'amber', next: 'ACCEPTED', action: 'Accept order' },
  { key: 'ACCEPTED', label: 'Accepted', tone: 'blue', next: 'PREPARING', action: 'Start preparing' },
  { key: 'PREPARING', label: 'Preparing', tone: 'violet', next: 'READY', action: 'Mark ready' },
  { key: 'READY', label: 'Ready for dispatch', tone: 'emerald', next: 'OUT_FOR_DELIVERY', action: 'Dispatch order' },
  { key: 'OUT_FOR_DELIVERY', label: 'Out for delivery', tone: 'cyan', next: 'DELIVERED', action: 'Confirm delivery' },
] as const;

const TERMINAL_DELIVERY_STATUSES = new Set(['CANCELLED', 'REFUNDED', 'DELIVERED']);

function formatAddress(value: unknown) {
  if (!value) return 'Address not provided';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).filter(Boolean).join(', ') || 'Address not provided';
  }
  return String(value);
}

function age(createdAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  return minutes < 1 ? 'Just now' : `${minutes} min ago`;
}

export function CommerceDeliveryClient() {
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

  const orders = useMemo(
    () => ((data?.data ?? []) as any[]).filter(
      (order) => order.orderType === 'DELIVERY' && !TERMINAL_DELIVERY_STATUSES.has(order.status),
    ),
    [data],
  );

  async function updateStatus(orderId: string, status: string) {
    if (!activeStoreId) return;
    setUpdating(orderId);
    try {
      const response = await fetch(`/api/commerce/manage/stores/${activeStoreId}/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error('Unable to update order status');
      await mutate();
    } finally {
      setUpdating(null);
    }
  }

  async function cancel(orderId: string) {
    if (!confirm('Cancel this delivery order?')) return;
    await updateStatus(orderId, 'CANCELLED');
  }

  return (
    <div className="delivery-ops">
      <header className="delivery-ops__header">
        <div>
          <p className="delivery-ops__eyebrow"><Truck size={14} /> Fulfilment operations</p>
          <h1>Delivery operations</h1>
          <p>Coordinate every delivery from kitchen handoff to customer confirmation.</p>
        </div>
        <div className="delivery-ops__controls">
          {stores.length > 1 && (
            <select className="commerce-select" value={activeStoreId} onChange={(event) => setStoreId(event.target.value)}>
              {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select>
          )}
          <button className="delivery-ops__refresh" onClick={() => mutate()}><RefreshCw size={15} /> Refresh</button>
        </div>
      </header>

      <div className="delivery-ops__summary">
        <div><span>Active deliveries</span><strong>{orders.length}</strong></div>
        <div><span>Out for delivery</span><strong>{orders.filter((order) => order.status === 'OUT_FOR_DELIVERY').length}</strong></div>
        <div><span>Awaiting dispatch</span><strong>{orders.filter((order) => order.status === 'READY').length}</strong></div>
        <div><span>Refresh cycle</span><strong>10 sec</strong></div>
      </div>

      {isLoading ? <div className="delivery-ops__loading"><Loader2 className="animate-spin" size={28} /></div> : (
        <div className="delivery-ops__board">
          {LANES.map((lane) => {
            const laneOrders = orders.filter((order) => order.status === lane.key);
            return <section className={`delivery-lane delivery-lane--${lane.tone}`} key={lane.key}>
              <div className="delivery-lane__heading"><div><span>{lane.label}</span><small>{laneOrders.length} {laneOrders.length === 1 ? 'order' : 'orders'}</small></div><span className="delivery-lane__count">{laneOrders.length}</span></div>
              <div className="delivery-lane__list">
                {!laneOrders.length && <div className="delivery-lane__empty">No orders in this stage</div>}
                {laneOrders.map((order) => {
                  const busy = updating === order.id;
                  return <article className="delivery-card" key={order.id}>
                    <div className="delivery-card__top"><strong>{order.orderRef}</strong><span><Clock3 size={12} /> {age(order.createdAt)}</span></div>
                    <h2>{order.customer?.name ?? 'Guest customer'}</h2>
                    <p className="delivery-card__address"><MapPin size={14} /> {formatAddress(order.deliveryAddress)}</p>
                    {order.deliveryNotes && <p className="delivery-card__notes">Note: {order.deliveryNotes}</p>}
                    <div className="delivery-card__items">{order.items?.map((item: any) => <span key={item.id}>{item.quantity}× {item.product?.name ?? item.productName}</span>)}</div>
                    <div className="delivery-card__footer"><strong>₦{Number(order.totalAmount).toLocaleString()}</strong><span>{order.paymentStatus === 'PAID' ? 'Paid online' : order.paymentStatus}</span></div>
                    {order.delivery?.driver && <p className="delivery-card__driver"><Send size={13} /> {order.delivery.driver.name} · {order.delivery.driver.phone}</p>}
                    <div className="delivery-card__actions">
                      <button disabled={busy} onClick={() => updateStatus(order.id, lane.next)}>{busy ? <Loader2 size={13} className="animate-spin" /> : lane.next === 'DELIVERED' ? <CheckCircle2 size={13} /> : <PackageCheck size={13} />} {lane.action}</button>
                      {lane.key !== 'OUT_FOR_DELIVERY' && <button className="delivery-card__cancel" disabled={busy} onClick={() => cancel(order.id)}><XCircle size={13} /> Cancel</button>}
                    </div>
                  </article>;
                })}
              </div>
            </section>;
          })}
        </div>
      )}

      <style>{`
        .delivery-ops{display:flex;flex-direction:column;gap:20px;color:#172033}.delivery-ops__header{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;flex-wrap:wrap}.delivery-ops__header h1{margin:4px 0;font-size:28px;font-weight:750}.delivery-ops__header p{margin:0;color:#7b8497;font-size:13px}.delivery-ops__eyebrow{display:flex;align-items:center;gap:7px!important;color:#0f766e!important;font-size:11px!important;font-weight:750;text-transform:uppercase;letter-spacing:.12em}.delivery-ops__controls{display:flex;gap:8px;align-items:center}.delivery-ops__refresh{display:flex;align-items:center;gap:7px;border:1px solid #dce2ea;background:#fff;border-radius:9px;padding:9px 13px;color:#354052;font-size:12px;font-weight:650;cursor:pointer}.delivery-ops__summary{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.delivery-ops__summary div{background:#fff;border:1px solid #e7ebf0;border-radius:12px;padding:14px 16px}.delivery-ops__summary span{display:block;color:#8b94a5;font-size:11px}.delivery-ops__summary strong{display:block;margin-top:5px;font-size:22px}.delivery-ops__board{display:grid;grid-template-columns:repeat(5,minmax(235px,1fr));gap:12px;overflow-x:auto;padding-bottom:12px}.delivery-lane{min-height:420px;background:#f8fafc;border:1px solid #e7ebf0;border-radius:14px;overflow:hidden}.delivery-lane__heading{display:flex;justify-content:space-between;align-items:center;padding:13px 14px;border-top:3px solid #94a3b8;background:#fff}.delivery-lane--amber .delivery-lane__heading{border-color:#f59e0b}.delivery-lane--blue .delivery-lane__heading{border-color:#3b82f6}.delivery-lane--violet .delivery-lane__heading{border-color:#8b5cf6}.delivery-lane--emerald .delivery-lane__heading{border-color:#10b981}.delivery-lane--cyan .delivery-lane__heading{border-color:#06b6d4}.delivery-lane__heading span{display:block;font-size:12px;font-weight:750}.delivery-lane__heading small{display:block;margin-top:3px;color:#9aa3b1;font-size:10px}.delivery-lane__count{border-radius:999px!important;background:#172033;color:#fff!important;padding:3px 8px}.delivery-lane__list{display:flex;flex-direction:column;gap:9px;padding:10px}.delivery-lane__empty{text-align:center;color:#aeb6c2;font-size:11px;padding:28px 5px}.delivery-card{background:#fff;border:1px solid #e6eaf0;border-radius:11px;padding:12px;box-shadow:0 3px 10px #17203308}.delivery-card__top,.delivery-card__footer{display:flex;justify-content:space-between;align-items:center;gap:8px}.delivery-card__top strong{font-size:11px}.delivery-card__top span{display:flex;gap:3px;align-items:center;color:#9aa3b1;font-size:10px}.delivery-card h2{margin:9px 0 6px;font-size:14px}.delivery-card__address,.delivery-card__notes,.delivery-card__driver{display:flex;gap:5px;align-items:flex-start;margin:5px 0;color:#687386;font-size:11px;line-height:1.45}.delivery-card__notes{color:#a16207}.delivery-card__items{display:flex;flex-wrap:wrap;gap:4px;margin:9px 0}.delivery-card__items span{background:#f1f5f9;border-radius:5px;padding:3px 5px;color:#536174;font-size:10px}.delivery-card__footer{border-top:1px solid #eef1f4;padding-top:8px;margin-top:4px}.delivery-card__footer strong{font-size:14px}.delivery-card__footer span{color:#0f766e;font-size:10px;text-transform:uppercase}.delivery-card__actions{display:flex;gap:6px;margin-top:10px}.delivery-card__actions button{display:flex;justify-content:center;align-items:center;gap:5px;flex:1;border:0;border-radius:7px;background:#172033;color:#fff;padding:8px 5px;font-size:10px;font-weight:700;cursor:pointer}.delivery-card__actions button:disabled{opacity:.5;cursor:not-allowed}.delivery-card__actions .delivery-card__cancel{flex:0 0 auto;background:#fff;color:#b42318;border:1px solid #f1c8c4}.delivery-ops__loading{display:flex;justify-content:center;align-items:center;min-height:320px;color:#0f766e}@media(max-width:900px){.delivery-ops__summary{grid-template-columns:repeat(2,1fr)}.delivery-ops__board{grid-template-columns:repeat(2,minmax(230px,1fr))}}@media(max-width:560px){.delivery-ops__summary{grid-template-columns:repeat(2,1fr)}.delivery-ops__board{grid-template-columns:1fr}.delivery-lane{min-height:auto}.delivery-ops__header h1{font-size:23px}}
      `}</style>
    </div>
  );
}
