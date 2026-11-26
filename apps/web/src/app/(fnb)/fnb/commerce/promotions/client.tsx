'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Plus, Loader2, Tag, Copy, Check, Trash2 } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const DISCOUNT_LABELS: Record<string, string> = {
  PERCENTAGE: '% Off',
  FIXED_AMOUNT: '₦ Off',
  FREE_DELIVERY: 'Free Delivery',
};

export function CommercePromotionsClient() {
  const { data: storesData } = useSWR('/api/commerce/manage/stores', fetcher);
  const stores: any[] = storesData?.data ?? [];
  const [storeId, setStoreId] = useState<string | null>(null);
  const activeStoreId = storeId ?? stores[0]?.id;

  const { data, mutate, isLoading } = useSWR(
    activeStoreId ? `/api/commerce/manage/stores/${activeStoreId}/promotions` : null,
    fetcher,
  );
  const promos: any[] = data?.data ?? [];

  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [form, setForm] = useState({
    code: '', discountType: 'PERCENTAGE', discountValue: '', minimumOrderAmount: '',
    maxUsageCount: '', validFrom: '', validTo: '', description: '', isActive: true,
  });

  function p(k: string, v: any) { setForm((prev) => ({ ...prev, [k]: v })); }

  async function create() {
    if (!activeStoreId) return;
    setSaving(true);
    try {
      await fetch(`/api/commerce/manage/stores/${activeStoreId}/promotions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          discountValue: parseFloat(form.discountValue),
          minimumOrderAmount: parseFloat(form.minimumOrderAmount) || 0,
          maxUsageCount: form.maxUsageCount ? parseInt(form.maxUsageCount) : undefined,
        }),
      });
      await mutate();
      setShowForm(false);
      setForm({ code: '', discountType: 'PERCENTAGE', discountValue: '', minimumOrderAmount: '', maxUsageCount: '', validFrom: '', validTo: '', description: '', isActive: true });
    } finally { setSaving(false); }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="promos-page">
      <div className="promos-header">
        <div>
          <h1 className="promos-title">Promotions</h1>
          <p className="promos-sub">Promo codes and discount campaigns for your store</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {stores.length > 1 && (
            <select className="commerce-select" value={activeStoreId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button className="promos-btn promos-btn--primary" onClick={() => setShowForm(true)}>
            <Plus size={14} /> New Promo
          </button>
        </div>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="promos-form-card">
          <h2 className="promos-form-title">Create Promo Code</h2>
          <div className="promos-form-grid">
            <div className="promos-field">
              <label>Code *</label>
              <input className="promos-input" value={form.code} onChange={(e) => p('code', e.target.value.toUpperCase())} placeholder="LAUNCH20" />
            </div>
            <div className="promos-field">
              <label>Discount Type *</label>
              <select className="promos-input" value={form.discountType} onChange={(e) => p('discountType', e.target.value)}>
                <option value="PERCENTAGE">Percentage Off</option>
                <option value="FIXED_AMOUNT">Fixed Amount Off</option>
                <option value="FREE_DELIVERY">Free Delivery</option>
              </select>
            </div>
            {form.discountType !== 'FREE_DELIVERY' && (
              <div className="promos-field">
                <label>Discount Value *</label>
                <input className="promos-input" type="number" min={0} value={form.discountValue} onChange={(e) => p('discountValue', e.target.value)} placeholder={form.discountType === 'PERCENTAGE' ? '20' : '500'} />
              </div>
            )}
            <div className="promos-field">
              <label>Min Order (₦)</label>
              <input className="promos-input" type="number" min={0} value={form.minimumOrderAmount} onChange={(e) => p('minimumOrderAmount', e.target.value)} placeholder="0" />
            </div>
            <div className="promos-field">
              <label>Max Uses</label>
              <input className="promos-input" type="number" min={1} value={form.maxUsageCount} onChange={(e) => p('maxUsageCount', e.target.value)} placeholder="Unlimited" />
            </div>
            <div className="promos-field">
              <label>Valid From</label>
              <input className="promos-input" type="datetime-local" value={form.validFrom} onChange={(e) => p('validFrom', e.target.value)} />
            </div>
            <div className="promos-field">
              <label>Valid To</label>
              <input className="promos-input" type="datetime-local" value={form.validTo} onChange={(e) => p('validTo', e.target.value)} />
            </div>
            <div className="promos-field promos-field--full">
              <label>Description</label>
              <input className="promos-input" value={form.description} onChange={(e) => p('description', e.target.value)} placeholder="Internal note about this promo" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            <button className="promos-btn promos-btn--ghost" onClick={() => setShowForm(false)}>Cancel</button>
            <button className="promos-btn promos-btn--primary" onClick={create} disabled={saving || !form.code || (!form.discountValue && form.discountType !== 'FREE_DELIVERY')}>
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Promo list */}
      {isLoading ? (
        <div className="promos-loading"><Loader2 className="animate-spin" size={28} /></div>
      ) : promos.length === 0 ? (
        <div className="promos-empty">
          <Tag size={40} style={{ opacity: 0.2 }} />
          <p>No promo codes yet. Create one to attract more orders.</p>
        </div>
      ) : (
        <div className="promos-list">
          {promos.map((promo: any) => {
            const expired = promo.validTo && new Date(promo.validTo) < new Date();
            return (
              <div key={promo.id} className={`promo-card ${!promo.isActive || expired ? 'promo-card--inactive' : ''}`}>
                <div className="promo-card__code-block">
                  <span className="promo-card__code">{promo.code}</span>
                  <button className="promo-copy-btn" onClick={() => copyCode(promo.code)}>
                    {copied === promo.code ? <Check size={13} /> : <Copy size={13} />}
                  </button>
                </div>
                <div className="promo-card__info">
                  <span className="promo-card__type">
                    {promo.discountType === 'PERCENTAGE' && `${promo.discountValue}% off`}
                    {promo.discountType === 'FIXED_AMOUNT' && `₦${Number(promo.discountValue).toLocaleString()} off`}
                    {promo.discountType === 'FREE_DELIVERY' && 'Free delivery'}
                  </span>
                  {promo.minimumOrderAmount > 0 && (
                    <span className="promo-card__min">Min order: ₦{Number(promo.minimumOrderAmount).toLocaleString()}</span>
                  )}
                  {promo.validTo && (
                    <span className={`promo-card__expiry ${expired ? 'promo-card__expiry--expired' : ''}`}>
                      {expired ? 'Expired' : `Expires ${new Date(promo.validTo).toLocaleDateString('en-NG')}`}
                    </span>
                  )}
                  <span className="promo-card__uses">
                    {promo.usageCount ?? 0}{promo.maxUsageCount ? `/${promo.maxUsageCount}` : ''} uses
                  </span>
                </div>
                <div className="promo-card__status">
                  <span className={`promo-badge ${promo.isActive && !expired ? 'promo-badge--active' : 'promo-badge--inactive'}`}>
                    {promo.isActive && !expired ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .promos-page { display: flex; flex-direction: column; gap: 20px; }
        .promos-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
        .promos-title { font-size: 22px; font-weight: 700; color: hsl(222 47% 11%); margin: 0; }
        .promos-sub { font-size: 13px; color: #6b7280; margin: 2px 0 0; }
        .promos-loading { display: flex; align-items: center; justify-content: center; min-height: 200px; color: #9ca3af; }
        .promos-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; min-height: 200px; justify-content: center; color: #9ca3af; text-align: center; }
        .promos-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 8px; border: none; font-size: 13px; font-weight: 500; cursor: pointer; transition: opacity 0.15s; }
        .promos-btn--primary { background: hsl(262 83% 58%); color: white; }
        .promos-btn--ghost { background: #f3f4f6; color: #374151; }
        .promos-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .promos-form-card { background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .promos-form-title { font-size: 16px; font-weight: 600; color: hsl(222 47% 11%); margin: 0; }
        .promos-form-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 14px; }
        .promos-field { display: flex; flex-direction: column; gap: 5px; }
        .promos-field--full { grid-column: 1 / -1; }
        .promos-field label { font-size: 12px; font-weight: 500; color: #374151; }
        .promos-input { padding: 8px 11px; border-radius: 7px; border: 1px solid #d1d5db; font-size: 13px; color: hsl(222 47% 11%); background: white; width: 100%; box-sizing: border-box; }
        .promos-input:focus { outline: none; border-color: hsl(262 83% 58%); box-shadow: 0 0 0 3px hsl(262 83% 95%); }

        .promos-list { display: flex; flex-direction: column; gap: 8px; }
        .promo-card {
          background: white; border: 1px solid #e5e7eb; border-radius: 10px;
          padding: 14px 16px; display: flex; align-items: center; gap: 16px; flex-wrap: wrap;
        }
        .promo-card--inactive { opacity: 0.55; }
        .promo-card__code-block { display: flex; align-items: center; gap: 8px; min-width: 160px; }
        .promo-card__code { font-size: 16px; font-weight: 800; color: hsl(222 47% 11%); font-family: monospace; letter-spacing: 0.05em; }
        .promo-copy-btn { background: #f3f4f6; border: none; border-radius: 6px; padding: 5px; cursor: pointer; color: #6b7280; display: flex; align-items: center; }
        .promo-copy-btn:hover { background: #e5e7eb; }
        .promo-card__info { flex: 1; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
        .promo-card__type { font-size: 13px; font-weight: 600; color: hsl(262 83% 50%); }
        .promo-card__min, .promo-card__uses { font-size: 12px; color: #9ca3af; }
        .promo-card__expiry { font-size: 12px; color: #6b7280; }
        .promo-card__expiry--expired { color: #ef4444; }
        .promo-card__status { margin-left: auto; }
        .promo-badge { font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
        .promo-badge--active { background: #dcfce7; color: #16a34a; }
        .promo-badge--inactive { background: #f3f4f6; color: #9ca3af; }

        .commerce-select { padding: 7px 12px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 13px; background: white; color: hsl(222 47% 11%); cursor: pointer; }
      `}</style>
    </div>
  );
}
