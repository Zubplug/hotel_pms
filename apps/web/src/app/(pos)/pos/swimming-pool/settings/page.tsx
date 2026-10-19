'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Settings2, RefreshCw, Loader2, Plus, Check, X,
  Pencil, ToggleLeft, ToggleRight, Waves, LayoutGrid,
  Ticket, AlertTriangle, Trash2, ChevronDown,
} from 'lucide-react';
import { formatMoney } from '../_components/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PassType {
  id: string;
  name: string;
  code: string;
  guestClass: string;
  price: number;
  currency: string;
  maxDuration: number;
  isComplimentary: boolean;
  isActive: boolean;
  productId: string | null;
  _count?: { entries: number };
}

interface PoolResource {
  id: string;
  name: string;
  code: string;
  type: string;
  status: string;
  isActive: boolean;
  facilityId: string;
}

interface Facility {
  id: string;
  name: string;
  status: string;
  capacity: number;
  isActive: boolean;
}

// ─── Pass Type Form ────────────────────────────────────────────────────────────

function PassTypeForm({ passType, facilityId, onClose, onSuccess }: {
  passType: PassType | null;
  facilityId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { provider } = useLodgeCoreProvider();
  const isEdit = Boolean(passType);
  const [form, setForm] = useState({
    name: passType?.name ?? '',
    code: passType?.code ?? '',
    guestClass: passType?.guestClass ?? 'ADULT',
    price: String(passType?.price ?? ''),
    currency: passType?.currency ?? 'NGN',
    maxDuration: String(passType?.maxDuration ?? 480),
    isComplimentary: passType?.isComplimentary ?? false,
    isActive: passType?.isActive ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.code.trim()) { setErr('Name and code are required'); return; }
    setBusy(true); setErr(null);
    try {
      const result = await provider.pool.applyOperation(isEdit ? 'configure_pass' : 'create_pass', { ...form, facilityId, passTypeId: passType?.id, price: Number(form.price), maxDuration: Number(form.maxDuration) });
      if (result?.success === false) throw new Error(result.error || 'Failed');
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally { setBusy(false); }
  };

  const GUEST_CLASSES = ['ADULT', 'CHILD', 'SENIOR', 'MEMBER', 'VIP', 'COMPLIMENTARY'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(2,6,23,0.82)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden" style={{ background: '#0d1724', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 28px 90px rgba(0,0,0,0.55)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0" style={{ borderColor: 'rgba(255,255,255,0.09)', background: '#0d1724' }}>
          <div className="flex items-center gap-2">
            <Ticket className="w-4 h-4" style={{ color: '#38bdf8' }} />
            <h3 className="text-sm font-black text-white">{isEdit ? 'Edit Pass Type' : 'New Pass Type'}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {err && <div className="text-[12px] p-3 rounded-xl" style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', color: '#fda4af' }}>{err}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Name</label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Adult Day Pass" className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Code</label>
              <input type="text" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="ADT-DAY" className="w-full px-3 py-2 rounded-xl text-sm font-mono" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Guest Class</label>
            <div className="grid grid-cols-3 gap-1">
              {GUEST_CLASSES.map((c) => (
                <button
                  key={c}
                  onClick={() => set('guestClass', c)}
                  className="py-1.5 rounded-xl text-[10px] font-bold transition-colors"
                  style={{
                    background: form.guestClass === c ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                    color: form.guestClass === c ? '#38bdf8' : '#64748b',
                    border: `1px solid ${form.guestClass === c ? 'rgba(56,189,248,0.28)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Price</label>
              <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => set('price', e.target.value)} placeholder="5000" className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Max Duration (min)</label>
              <input type="number" min="30" max="1440" value={form.maxDuration} onChange={(e) => set('maxDuration', e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => set('isComplimentary', !form.isComplimentary)}
              className="flex items-center gap-2 text-[12px] font-semibold"
              style={{ color: form.isComplimentary ? '#f59e0b' : '#64748b' }}
            >
              {form.isComplimentary ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
              Complimentary pass
            </button>
            {isEdit && (
              <button
                onClick={() => set('isActive', !form.isActive)}
                className="flex items-center gap-2 text-[12px] font-semibold ml-auto"
                style={{ color: form.isActive ? '#34d399' : '#64748b' }}
              >
                {form.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                {form.isActive ? 'Active' : 'Inactive'}
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>Cancel</button>
          <button onClick={submit} disabled={busy} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black" style={{ background: 'rgba(56,189,248,0.18)', color: '#38bdf8' }}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isEdit ? 'Save Changes' : 'Create Pass'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Resource Form ─────────────────────────────────────────────────────────────

function ResourceForm({ resource, facilityId, onClose, onSuccess }: {
  resource: PoolResource | null;
  facilityId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { provider } = useLodgeCoreProvider();
  const isEdit = Boolean(resource);
  const [form, setForm] = useState({
    name: resource?.name ?? '',
    code: resource?.code ?? '',
    type: resource?.type ?? 'LOUNGER',
    status: resource?.status ?? 'AVAILABLE',
    isActive: resource?.isActive ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));
  const TYPES = ['CABANA', 'LOUNGER', 'LOCKER', 'TOWEL'];

  const submit = async () => {
    if (!form.name.trim() || !form.code.trim()) { setErr('Name and code are required'); return; }
    setBusy(true); setErr(null);
    try {
      const result = await provider.pool.applyOperation(isEdit ? 'update_resource' : 'create_resource', { ...form, facilityId, id: resource?.id });
      if (result?.success === false) throw new Error(result.error || 'Failed');
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(2,6,23,0.82)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden" style={{ background: '#0d1724', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 28px 90px rgba(0,0,0,0.55)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.09)' }}>
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4" style={{ color: '#38bdf8' }} />
            <h3 className="text-sm font-black text-white">{isEdit ? 'Edit Resource' : 'New Resource'}</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {err && <div className="text-[12px] p-3 rounded-xl" style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', color: '#fda4af' }}>{err}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Name</label>
              <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Cabana A1" className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Code</label>
              <input type="text" value={form.code} onChange={(e) => set('code', e.target.value.toUpperCase())} placeholder="CAB-A1" className="w-full px-3 py-2 rounded-xl text-sm font-mono" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Type</label>
            <div className="grid grid-cols-4 gap-1">
              {TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => set('type', t)}
                  className="py-2 rounded-xl text-[11px] font-bold transition-colors"
                  style={{
                    background: form.type === t ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                    color: form.type === t ? '#38bdf8' : '#64748b',
                    border: `1px solid ${form.type === t ? 'rgba(56,189,248,0.28)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {isEdit && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => set('isActive', !form.isActive)}
                className="flex items-center gap-2 text-[12px] font-semibold"
                style={{ color: form.isActive ? '#34d399' : '#64748b' }}
              >
                {form.isActive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                {form.isActive ? 'Active' : 'Deactivated'}
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>Cancel</button>
          <button onClick={submit} disabled={busy} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black" style={{ background: 'rgba(56,189,248,0.18)', color: '#38bdf8' }}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {isEdit ? 'Save' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Settings Page ────────────────────────────────────────────────────────

type SettingsTab = 'pass-types' | 'resources' | 'facility';

export default function SettingsPage() {
  const { provider } = useLodgeCoreProvider();
  const [activeTab, setActiveTab] = useState<SettingsTab>('pass-types');
  const [passTypes, setPassTypes] = useState<PassType[]>([]);
  const [resources, setResources] = useState<PoolResource[]>([]);
  const [facility, setFacility] = useState<Facility | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPassForm, setShowPassForm] = useState<PassType | null | 'new'>(null);
  const [showResourceForm, setShowResourceForm] = useState<PoolResource | null | 'new'>(null);
  const [includeInactive, setIncludeInactive] = useState(false);
  const facilityId = typeof window !== 'undefined' ? localStorage.getItem('pool_facility_id') : null;

  const load = useCallback(async () => {
    try {
      const snapshot = await provider.pool.getSnapshot('', facilityId);
      const facilityData = snapshot.data?.facility ?? snapshot.data?.facilities?.[0] ?? null;
      setFacility(facilityData);
      setPassTypes((facilityData?.passTypes ?? []).filter((pass: PassType) => includeInactive || pass.isActive !== false));
      setResources((facilityData?.resources ?? []).filter((resource: PoolResource) => includeInactive || resource.isActive !== false));
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [facilityId, includeInactive, provider.pool]);

  useEffect(() => { load(); }, [load]);

  const tabs: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
    { key: 'pass-types', label: 'Pass Types', icon: Ticket },
    { key: 'resources', label: 'Resources', icon: LayoutGrid },
    { key: 'facility', label: 'Facility', icon: Waves },
  ];

  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#38bdf8' }} />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.05)', width: 'fit-content' }}>
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-[12px] font-bold transition-colors"
            style={{
              background: activeTab === key ? 'rgba(56,189,248,0.18)' : 'transparent',
              color: activeTab === key ? '#38bdf8' : '#64748b',
            }}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ─── Pass Types ─────────────────────────────────────────────────────── */}
      {activeTab === 'pass-types' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-white">Pass Types</h3>
            <button
              onClick={() => setIncludeInactive(!includeInactive)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-colors"
              style={{ background: includeInactive ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.06)', color: includeInactive ? '#f59e0b' : '#64748b' }}
            >
              {includeInactive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              Show inactive
            </button>
            <div className="flex-1" />
            <button onClick={load} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {facility && (
              <button
                onClick={() => setShowPassForm('new')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: 'rgba(56,189,248,0.16)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.28)' }}
              >
                <Plus className="w-3.5 h-3.5" /> New Pass Type
              </button>
            )}
          </div>

          {passTypes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Ticket className="w-8 h-8 opacity-15" style={{ color: '#38bdf8' }} />
              <p className="text-sm" style={{ color: '#475569' }}>No pass types configured</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
              {passTypes.map((pt, i) => (
                <div key={pt.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.06)', opacity: pt.isActive ? 1 : 0.5 }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{pt.name}</p>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)', color: '#64748b' }}>{pt.code}</span>
                      {!pt.isActive && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.14)', color: '#f59e0b' }}>INACTIVE</span>}
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>
                      {pt.guestClass} · {pt.isComplimentary ? 'Complimentary' : formatMoney(Number(pt.price), pt.currency)} · Max {Math.round(pt.maxDuration / 60)}h
                      {pt._count?.entries ? ` · ${pt._count.entries} entries` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowPassForm(pt)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-xl text-[11px]" style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.12)', color: '#64748b' }}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#38bdf8' }} />
            Pass types are never deleted — deactivating a pass type preserves all historical admission and payment records. Guests with reserved admissions using a deactivated pass can still be checked in.
          </div>
        </div>
      )}

      {/* ─── Resources ──────────────────────────────────────────────────────── */}
      {activeTab === 'resources' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h3 className="text-sm font-bold text-white">Pool Resources</h3>
            <button
              onClick={() => setIncludeInactive(!includeInactive)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ background: includeInactive ? 'rgba(245,158,11,0.14)' : 'rgba(255,255,255,0.06)', color: includeInactive ? '#f59e0b' : '#64748b' }}
            >
              {includeInactive ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
              Show inactive
            </button>
            <div className="flex-1" />
            <button onClick={load} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
            {facility && (
              <button
                onClick={() => setShowResourceForm('new')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: 'rgba(56,189,248,0.16)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.28)' }}
              >
                <Plus className="w-3.5 h-3.5" /> New Resource
              </button>
            )}
          </div>

          {resources.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <LayoutGrid className="w-8 h-8 opacity-15" style={{ color: '#38bdf8' }} />
              <p className="text-sm" style={{ color: '#475569' }}>No resources configured</p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
              {resources.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.06)', opacity: r.isActive ? 1 : 0.5 }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{r.name}</p>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.07)', color: '#64748b' }}>{r.code}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc' }}>{r.type}</span>
                      {!r.isActive && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(245,158,11,0.14)', color: '#f59e0b' }}>INACTIVE</span>}
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>Status: {r.status}</p>
                  </div>
                  <button
                    onClick={() => setShowResourceForm(r)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/8 transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-2 p-3 rounded-xl text-[11px]" style={{ background: 'rgba(56,189,248,0.06)', border: '1px solid rgba(56,189,248,0.12)', color: '#64748b' }}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#38bdf8' }} />
            Resources with active bookings cannot be deactivated or put into maintenance. Resolve active bookings first.
          </div>
        </div>
      )}

      {/* ─── Facility ────────────────────────────────────────────────────────── */}
      {activeTab === 'facility' && (
        <div className="space-y-4">
          {!facility ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Waves className="w-10 h-10 opacity-20" style={{ color: '#38bdf8' }} />
              <p className="text-sm font-bold text-white">No Facility Found</p>
              <p className="text-[12px] max-w-xs" style={{ color: '#475569' }}>
                Pool facilities are configured in the main PMS property settings. Contact your system administrator.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(13,23,36,0.60)' }}>
              {[
                { l: 'Facility Name', v: facility.name },
                { l: 'Status', v: facility.status },
                { l: 'Capacity', v: `${facility.capacity} guests` },
                { l: 'Active', v: facility.isActive ? 'Yes' : 'No' },
                { l: 'ID', v: facility.id },
              ].map(({ l, v }) => (
                <div key={l} className="flex items-center justify-between px-4 py-3 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
                  <span className="text-[12px]" style={{ color: '#64748b' }}>{l}</span>
                  <span className="text-[12px] font-bold text-white">{v}</span>
                </div>
              ))}
            </div>
          )}
          <div className="flex items-start gap-2 p-3 rounded-xl text-[11px]" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.15)', color: '#64748b' }}>
            <Settings2 className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: '#f59e0b' }} />
            To change facility capacity, name, or operational status, use the main Property Settings in the hotel administration panel.
          </div>
        </div>
      )}

      {/* Forms */}
      {showPassForm && facility && (
        <PassTypeForm
          passType={showPassForm === 'new' ? null : showPassForm}
          facilityId={facility.id}
          onClose={() => setShowPassForm(null)}
          onSuccess={() => { setShowPassForm(null); load(); }}
        />
      )}
      {showResourceForm && facility && (
        <ResourceForm
          resource={showResourceForm === 'new' ? null : showResourceForm}
          facilityId={facility.id}
          onClose={() => setShowResourceForm(null)}
          onSuccess={() => { setShowResourceForm(null); load(); }}
        />
      )}
    </div>
  );
}
