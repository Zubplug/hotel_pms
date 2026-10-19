'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  LayoutGrid, RefreshCw, Loader2, Plus, X, Check,
  Umbrella, ChevronDown, Settings2,
  Armchair, Lock, Shirt,
} from 'lucide-react';
import { RESOURCE_STATUS_STYLES, POOL_API, formatDateTime } from '../_components/utils';

type ResourceType = 'CABANA' | 'LOUNGER' | 'LOCKER' | 'TOWEL';
type ResourceStatus = 'AVAILABLE' | 'OCCUPIED' | 'CLEANING' | 'MAINTENANCE';

interface ResourceBooking {
  id: string;
  status: string;
  startAt: string;
  endAt: string;
  entry: { guest: { firstName: string; lastName: string } | null } | null;
}

interface PoolResource {
  id: string;
  name: string;
  code: string;
  type: ResourceType;
  status: ResourceStatus;
  isActive: boolean;
  facility: { name: string };
  bookings: ResourceBooking[];
}

const RESOURCE_ICONS: Record<ResourceType, React.ElementType> = {
  CABANA: Umbrella,
  LOUNGER: Armchair,
  LOCKER: Lock,
  TOWEL: Shirt,
};

const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  CABANA: 'Cabana',
  LOUNGER: 'Lounger',
  LOCKER: 'Locker',
  TOWEL: 'Towel',
};

const STATUS_QUICK = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'] as const;

function ResourceCard({ resource, onStatusChange, onBook }: {
  resource: PoolResource;
  onStatusChange: (id: string, status: ResourceStatus) => void;
  onBook: (resource: PoolResource) => void;
}) {
  const [statusOpen, setStatusOpen] = useState(false);
  const st = RESOURCE_STATUS_STYLES[resource.status] ?? { bg: 'rgba(100,116,139,0.14)', text: '#94a3b8', label: resource.status };
  const Icon = RESOURCE_ICONS[resource.type] ?? LayoutGrid;
  const activeBooking = resource.bookings.find(b => b.status === 'ACTIVE' || b.status === 'BOOKED');

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${resource.status === 'AVAILABLE' ? 'rgba(52,211,153,0.20)' : resource.status === 'MAINTENANCE' ? 'rgba(244,63,94,0.20)' : 'rgba(255,255,255,0.09)'}`,
        background: 'rgba(13,23,36,0.70)',
        opacity: resource.isActive ? 1 : 0.45,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${st.text}1a` }}>
          <Icon className="w-4.5 h-4.5" style={{ color: st.text }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white truncate">{resource.name}</p>
          <p className="text-[10px] font-mono" style={{ color: '#475569' }}>{resource.code} · {RESOURCE_TYPE_LABELS[resource.type]}</p>
        </div>
        {/* Status dropdown */}
        <div className="relative">
          <button
            onClick={() => setStatusOpen(!statusOpen)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold"
            style={{ background: st.bg, color: st.text }}
          >
            {st.label}
            <ChevronDown className={`w-3 h-3 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
          </button>
          {statusOpen && (
            <div className="absolute right-0 top-full mt-1 z-20 rounded-xl overflow-hidden" style={{ background: '#0d1724', border: '1px solid rgba(255,255,255,0.12)', minWidth: 140, boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
              {STATUS_QUICK.map((s) => {
                const ss = RESOURCE_STATUS_STYLES[s];
                return (
                  <button
                    key={s}
                    onClick={() => { onStatusChange(resource.id, s); setStatusOpen(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12px] hover:bg-white/5 transition-colors"
                    style={{ color: s === resource.status ? ss.text : '#94a3b8' }}
                  >
                    {s === resource.status && <Check className="w-3 h-3" />}
                    <span className={s !== resource.status ? 'ml-4' : ''}>{ss.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3">
        {activeBooking ? (
          <div className="text-[12px]" style={{ color: '#64748b' }}>
            <p className="font-semibold" style={{ color: '#94a3b8' }}>
              {activeBooking.entry?.guest
                ? `${activeBooking.entry.guest.firstName} ${activeBooking.entry.guest.lastName}`
                : 'Guest'}
            </p>
            <p className="mt-0.5">
              Until {formatDateTime(activeBooking.endAt)}
            </p>
          </div>
        ) : (
          <p className="text-[12px]" style={{ color: '#475569' }}>No active booking</p>
        )}
      </div>

      {/* Action */}
      {resource.isActive && resource.status === 'AVAILABLE' && (
        <div className="px-4 pb-3">
          <button
            onClick={() => onBook(resource)}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-colors"
            style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.22)' }}
          >
            <Plus className="w-3 h-3" /> Book Resource
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Book dialog ──────────────────────────────────────────────────────────────

function BookDialog({ resource, onClose, onSuccess }: {
  resource: PoolResource;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const now = new Date();
  const [startAt, setStartAt] = useState(now.toISOString().slice(0, 16));
  const [endAt, setEndAt] = useState(new Date(now.getTime() + 4 * 3600_000).toISOString().slice(0, 16));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`${POOL_API}/resources`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceId: resource.id, startAt: new Date(startAt).toISOString(), endAt: new Date(endAt).toISOString(), notes: notes || undefined }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Booking failed'); }
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Booking failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(2,6,23,0.80)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden" style={{ background: '#0d1724', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 28px 90px rgba(0,0,0,0.55)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.09)' }}>
          <h3 className="text-sm font-black text-white">Book {resource.name}</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {err && <div className="text-[12px] text-red-400 p-3 rounded-xl" style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)' }}>{err}</div>}
          {[
            { l: 'Start', v: startAt, set: setStartAt },
            { l: 'End', v: endAt, set: setEndAt },
          ].map(({ l, v, set }) => (
            <div key={l}>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>{l}</label>
              <input type="datetime-local" value={v} onChange={(e) => set(e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
            </div>
          ))}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Notes</label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-4">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>Cancel</button>
          <button onClick={submit} disabled={busy} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black" style={{ background: 'rgba(56,189,248,0.18)', color: '#38bdf8' }}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Confirm Booking
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ResourcesPage() {
  const [resources, setResources] = useState<PoolResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [bookTarget, setBookTarget] = useState<PoolResource | null>(null);
  const facilityId = typeof window !== 'undefined' ? localStorage.getItem('pool_facility_id') : null;

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (facilityId) params.set('facilityId', facilityId);
      // Use the manage endpoint for resource data with bookings
      const res = await fetch(`${POOL_API}/resources/manage?${params.toString()}`);
      const json = await res.json();
      setResources(json.data ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id: string, status: ResourceStatus) => {
    try {
      await fetch(`${POOL_API}/resources/manage/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      await load();
    } catch { alert('Status update failed'); }
  };

  const types = ['ALL', 'CABANA', 'LOUNGER', 'LOCKER', 'TOWEL'];
  const filtered = typeFilter === 'ALL' ? resources : resources.filter(r => r.type === typeFilter);

  const summary = {
    total: resources.length,
    available: resources.filter(r => r.status === 'AVAILABLE').length,
    occupied: resources.filter(r => r.status === 'OCCUPIED' || r.bookings.some(b => b.status === 'ACTIVE')).length,
    maintenance: resources.filter(r => r.status === 'MAINTENANCE').length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full" style={{ minHeight: 400 }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#38bdf8' }} />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { l: 'Total', v: summary.total, colour: '#94a3b8' },
          { l: 'Available', v: summary.available, colour: '#34d399' },
          { l: 'Occupied', v: summary.occupied, colour: '#38bdf8' },
          { l: 'Maintenance', v: summary.maintenance, colour: '#fda4af' },
        ].map(({ l, v, colour }) => (
          <div key={l} className="pool-metric text-center py-3">
            <p className="text-2xl font-black text-white">{v}</p>
            <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: colour }}>
              {l}
            </p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setTypeFilter(t)}
            className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all"
            style={{
              background: typeFilter === t ? 'rgba(56,189,248,0.18)' : 'rgba(255,255,255,0.06)',
              color: typeFilter === t ? '#38bdf8' : '#64748b',
              border: `1px solid ${typeFilter === t ? 'rgba(56,189,248,0.30)' : 'rgba(255,255,255,0.08)'}`,
            }}
          >
            {t === 'ALL' ? 'All Types' : RESOURCE_TYPE_LABELS[t as ResourceType]}
          </button>
        ))}
        <div className="flex-1" />
        <button onClick={load} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <a href="/pos/swimming-pool/settings" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold" style={{ background: 'rgba(255,255,255,0.06)', color: '#64748b' }}>
          <Settings2 className="w-3.5 h-3.5" /> Manage Resources
        </a>
      </div>

      {/* Resource grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-2">
          <LayoutGrid className="w-8 h-8 opacity-15" style={{ color: '#38bdf8' }} />
          <p className="text-sm" style={{ color: '#475569' }}>No resources found. Create them in Settings.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((r) => (
            <ResourceCard
              key={r.id}
              resource={r}
              onStatusChange={handleStatusChange}
              onBook={setBookTarget}
            />
          ))}
        </div>
      )}

      {bookTarget && (
        <BookDialog
          resource={bookTarget}
          onClose={() => setBookTarget(null)}
          onSuccess={() => { setBookTarget(null); load(); }}
        />
      )}
    </div>
  );
}
