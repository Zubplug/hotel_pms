'use client';

import React, { useState } from 'react';
import useSWR from 'swr';
import { Save, Loader2, Store, CreditCard, Truck, Bell, Globe } from 'lucide-react';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TABS = [
  { key: 'general',  label: 'General',  icon: Store },
  { key: 'payment',  label: 'Payment',  icon: CreditCard },
  { key: 'delivery', label: 'Delivery', icon: Truck },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'storefront',    label: 'Storefront',    icon: Globe },
];

export function CommerceSetupClient() {
  const [activeTab, setActiveTab] = useState('general');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const { data: storesData } = useSWR('/api/commerce/manage/stores', fetcher);
  const stores: any[] = storesData?.data ?? [];
  const [storeId, setStoreId] = useState<string | null>(null);
  const activeStoreId = storeId ?? stores[0]?.id;

  const { data: storeData, mutate } = useSWR(
    activeStoreId ? `/api/commerce/manage/stores/${activeStoreId}` : null,
    fetcher,
  );
  const store = storeData?.data;

  const [form, setForm] = useState<Record<string, any>>({});
  const merged = { ...store, ...form };

  function patch(key: string, value: any) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (!activeStoreId) return;
    setSaving(true);
    try {
      await fetch(`/api/commerce/manage/stores/${activeStoreId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSaved(true);
      await mutate();
      setTimeout(() => setSaved(false), 2500);
      setForm({});
    } finally {
      setSaving(false);
    }
  }

  if (!store && !storesData) {
    return <div className="setup-loading"><Loader2 className="animate-spin" size={28} /></div>;
  }

  if (stores.length === 0) {
    return <CreateStoreForm onCreated={() => mutate()} />;
  }

  return (
    <div className="setup-page">
      <div className="setup-header">
        <div>
          <h1 className="setup-title">Store Setup</h1>
          <p className="setup-sub">Configure your Food Commerce store</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {stores.length > 1 && (
            <select className="commerce-select" value={activeStoreId} onChange={(e) => setStoreId(e.target.value)}>
              {stores.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
          <button className="setup-save-btn" onClick={save} disabled={saving || Object.keys(form).length === 0}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saved ? 'Saved!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="setup-tabs">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`setup-tab ${activeTab === tab.key ? 'setup-tab--active' : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* General */}
      {activeTab === 'general' && (
        <div className="setup-section">
          <Field label="Store Name" required>
            <input className="setup-input" value={merged.name ?? ''} onChange={(e) => patch('name', e.target.value)} placeholder="e.g. The Grand Bistro" />
          </Field>
          <Field label="Description">
            <textarea className="setup-input setup-textarea" value={merged.description ?? ''} onChange={(e) => patch('description', e.target.value)} placeholder="Describe your restaurant…" rows={3} />
          </Field>
          <Field label="Slug" hint={`Public URL: /store/${merged.slug ?? '…'}`}>
            <input className="setup-input" value={merged.slug ?? ''} onChange={(e) => patch('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="my-restaurant" />
          </Field>
          <Field label="Currency">
            <select className="setup-input" value={merged.currency ?? 'NGN'} onChange={(e) => patch('currency', e.target.value)}>
              <option value="NGN">NGN — Nigerian Naira</option>
              <option value="USD">USD — US Dollar</option>
              <option value="GHS">GHS — Ghanaian Cedi</option>
              <option value="KES">KES — Kenyan Shilling</option>
              <option value="ZAR">ZAR — South African Rand</option>
            </select>
          </Field>
          <Field label="Store Status">
            <select className="setup-input" value={merged.status ?? 'DRAFT'} onChange={(e) => patch('status', e.target.value)}>
              <option value="ACTIVE">Active — accepting orders</option>
              <option value="DRAFT">Draft — not visible</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="CLOSED">Closed</option>
            </select>
          </Field>
        </div>
      )}

      {/* Payment */}
      {activeTab === 'payment' && (
        <div className="setup-section">
          <div style={{ padding: 16, borderRadius: 10, background: '#f5f3ff', border: '1px solid #ddd6fe' }}>
            <strong style={{ display: 'block', color: '#312e81', marginBottom: 6 }}>Property payment account</strong>
            <span style={{ display: 'block', color: '#4b5563', fontSize: 13, lineHeight: 1.5 }}>
              {merged.paymentAccountConfigured
                ? `Online payments use the property account (${merged.paymentProvider}). This is shared with reservations and corporate payments.`
                : 'No active property payment account is configured yet. Configure it in Property Settings before publishing online payments.'}
            </span>
          </div>
          <Field label="Minimum Order Amount (₦)">
            <input className="setup-input" type="number" min={0} value={merged.minimumOrderAmount ?? 0} onChange={(e) => patch('minimumOrderAmount', parseFloat(e.target.value))} />
          </Field>
        </div>
      )}

      {/* Delivery */}
      {activeTab === 'delivery' && (
        <div className="setup-section">
          <Field label="Order Types">
            <div className="setup-checks">
              <label className="setup-check"><input type="checkbox" checked={!!merged.pickupEnabled} onChange={(e) => patch('pickupEnabled', e.target.checked)} /> Pickup</label>
              <label className="setup-check"><input type="checkbox" checked={!!merged.deliveryEnabled} onChange={(e) => patch('deliveryEnabled', e.target.checked)} /> Delivery</label>
            </div>
          </Field>
          <Field label="Delivery Fee (₦)">
            <input className="setup-input" type="number" min={0} value={merged.deliveryFee ?? 0} onChange={(e) => patch('deliveryFee', parseFloat(e.target.value))} />
          </Field>
        </div>
      )}

      {/* Notifications */}
      {activeTab === 'notifications' && (
        <div className="setup-section">
          <Field label="Notification Channels">
            <div className="setup-checks">
              <label className="setup-check"><input type="checkbox" checked={!!merged.notifySmsEnabled} onChange={(e) => patch('notifySmsEnabled', e.target.checked)} /> SMS (Termii)</label>
              <label className="setup-check"><input type="checkbox" checked={!!merged.notifyEmailEnabled} onChange={(e) => patch('notifyEmailEnabled', e.target.checked)} /> Email (Resend)</label>
            </div>
          </Field>
          <Field label="SMS Sender Name" hint="Max 11 characters. Must be approved by Termii.">
            <input className="setup-input" maxLength={11} value={merged.termiiSenderName ?? ''} onChange={(e) => patch('termiiSenderName', e.target.value)} placeholder="MyRestaurant" />
          </Field>
        </div>
      )}

      {/* Storefront */}
      {activeTab === 'storefront' && (
        <div className="setup-section">
          <Field label="Logo URL">
            <input className="setup-input" type="url" value={merged.logoUrl ?? ''} onChange={(e) => patch('logoUrl', e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Banner URL">
            <input className="setup-input" type="url" value={merged.bannerUrl ?? ''} onChange={(e) => patch('bannerUrl', e.target.value)} placeholder="https://…" />
          </Field>
          <Field label="Brand Colour">
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input type="color" value={merged.primaryColor ?? '#7c3aed'} onChange={(e) => patch('primaryColor', e.target.value)} style={{ width: 40, height: 36, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer' }} />
              <input className="setup-input" value={merged.primaryColor ?? '#7c3aed'} onChange={(e) => patch('primaryColor', e.target.value)} placeholder="#7c3aed" style={{ flex: 1 }} />
            </div>
          </Field>
        </div>
      )}

      <style>{`
        .setup-page { display: flex; flex-direction: column; gap: 20px; max-width: 720px; }
        .setup-header { display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px; }
        .setup-title { font-size: 22px; font-weight: 700; color: hsl(222 47% 11%); margin: 0; }
        .setup-sub { font-size: 13px; color: #6b7280; margin: 2px 0 0; }
        .setup-loading { display: flex; align-items: center; justify-content: center; min-height: 300px; color: #9ca3af; }
        .setup-save-btn {
          display: flex; align-items: center; gap: 6px;
          padding: 8px 16px; border-radius: 8px; border: none;
          background: hsl(262 83% 58%); color: white; font-size: 13px; font-weight: 500;
          cursor: pointer; transition: opacity 0.15s;
        }
        .setup-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .setup-tabs { display: flex; gap: 4px; border-bottom: 1px solid #e5e7eb; overflow-x: auto; }
        .setup-tab {
          display: flex; align-items: center; gap: 6px;
          padding: 10px 14px; border: none; background: none;
          font-size: 13px; color: #6b7280; cursor: pointer;
          border-bottom: 2px solid transparent; white-space: nowrap;
          transition: color 0.15s, border-color 0.15s;
        }
        .setup-tab--active { color: hsl(262 83% 58%); border-bottom-color: hsl(262 83% 58%); font-weight: 500; }
        .setup-tab:hover:not(.setup-tab--active) { color: hsl(222 47% 20%); }
        .setup-section { display: flex; flex-direction: column; gap: 20px; }
        .setup-field { display: flex; flex-direction: column; gap: 6px; }
        .setup-label { font-size: 13px; font-weight: 500; color: hsl(222 47% 11%); }
        .setup-hint { font-size: 11px; color: #9ca3af; }
        .setup-input {
          padding: 9px 12px; border-radius: 8px; border: 1px solid #d1d5db;
          font-size: 14px; color: hsl(222 47% 11%); background: white;
          transition: border-color 0.15s; width: 100%; box-sizing: border-box;
        }
        .setup-input:focus { outline: none; border-color: hsl(262 83% 58%); box-shadow: 0 0 0 3px hsl(262 83% 95%); }
        .setup-textarea { resize: vertical; min-height: 80px; font-family: inherit; }
        .setup-checks { display: flex; gap: 20px; flex-wrap: wrap; }
        .setup-check { display: flex; align-items: center; gap: 8px; font-size: 14px; color: hsl(222 47% 11%); cursor: pointer; }
        .commerce-select { padding: 7px 12px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 13px; background: white; color: hsl(222 47% 11%); cursor: pointer; }
      `}</style>
    </div>
  );
}
function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="setup-field">
      <label className="setup-label">{label}{required && <span style={{ color: '#ef4444', marginLeft: 4 }}>*</span>}</label>
      {children}
      {hint && <p className="setup-hint">{hint}</p>}
    </div>
  );
}

function CreateStoreForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [creating, setCreating] = useState(false);
  const { data: propertiesData } = useSWR('/api/v1/properties', fetcher);
  const properties: any[] = propertiesData?.data ?? [];
  const [propertyId, setPropertyId] = useState('');

  async function create() {
    if (!name || !slug || !propertyId) return;
    setCreating(true);
    try {
      const res = await fetch('/api/commerce/manage/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, propertyId, currency: 'NGN' }),
      });
      if (res.ok) onCreated();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="setup-page">
      <h1 className="setup-title">Create Your Store</h1>
      <p style={{ color: '#6b7280', fontSize: 14, margin: 0 }}>Set up your first Food Commerce store to start accepting online orders.</p>
      <div className="setup-section">
        <Field label="Store Name" required>
          <input className="setup-input" value={name} onChange={(e) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-')); }} placeholder="e.g. The Grand Bistro" />
        </Field>
        <Field label="Slug" hint={`Customers will order from: /api/commerce/storefront/${slug || '…'}`} required>
          <input className="setup-input" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="the-grand-bistro" />
        </Field>
        <Field label="Property" required>
          <select className="setup-input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Select property…</option>
            {properties.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <button className="setup-save-btn" onClick={create} disabled={creating || !name || !slug || !propertyId}>
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Store size={14} />}
          Create Store
        </button>
      </div>
      <style>{`
        .setup-page { display: flex; flex-direction: column; gap: 20px; max-width: 720px; }
        .setup-title { font-size: 22px; font-weight: 700; color: hsl(222 47% 11%); margin: 0; }
        .setup-section { display: flex; flex-direction: column; gap: 20px; }
        .setup-field { display: flex; flex-direction: column; gap: 6px; }
        .setup-label { font-size: 13px; font-weight: 500; color: hsl(222 47% 11%); }
        .setup-hint { font-size: 11px; color: #9ca3af; }
        .setup-input { padding: 9px 12px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 14px; color: hsl(222 47% 11%); background: white; width: 100%; box-sizing: border-box; }
        .setup-input:focus { outline: none; border-color: hsl(262 83% 58%); box-shadow: 0 0 0 3px hsl(262 83% 95%); }
        .setup-save-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border-radius: 8px; border: none; background: hsl(262 83% 58%); color: white; font-size: 14px; font-weight: 500; cursor: pointer; align-self: flex-start; }
        .setup-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
