'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Filter, ChevronDown, Loader2, UserCheck, UserX,
  RefreshCw, Ticket, ChevronLeft, ChevronRight, User,
  Clock, CreditCard, CheckCircle2, XCircle, AlertTriangle,
  ScanLine, Calendar,
} from 'lucide-react';
import Link from 'next/link';
import {
  formatMoney, formatDateTime, formatDuration,
  ENTRY_STATUS_STYLES, POOL_API,
} from '../_components/utils';

const STATUSES = ['RESERVED', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

interface PoolEntry {
  id: string;
  entryNumber: string;
  identifier: string | null;
  status: string;
  guestCount: number;
  entryDate: string;
  admittedAt: string | null;
  exitedAt: string | null;
  createdAt: string;
  notes: string | null;
  guest: { id: string; firstName: string; lastName: string; phone: string } | null;
  passType: { id: string; name: string; code: string; guestClass: string; price: number; currency: string };
  facility: { id: string; name: string } | null;
  posOrder: { id: string; orderNumber: string; total: number; paymentStatus: string } | null;
  resourceBookings: { resource: { name: string; type: string } }[];
}

function EntryDetailPanel({ entry, onClose, onCheckout, onCheckin, busy }: {
  entry: PoolEntry;
  onClose: () => void;
  onCheckout: () => void;
  onCheckin: () => void;
  busy: boolean;
}) {
  const st = ENTRY_STATUS_STYLES[entry.status as keyof typeof ENTRY_STATUS_STYLES]
    ?? { bg: 'rgba(100,116,139,0.14)', text: '#94a3b8', label: entry.status };

  return (
    <div className="h-full flex flex-col" style={{ background: '#08111c', borderLeft: '1px solid rgba(255,255,255,0.09)' }}>
      <div className="flex items-center justify-between px-5 py-4 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: '#475569' }}>Admission Detail</p>
          <p className="text-sm font-black text-white">{entry.entryNumber}</p>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-500 hover:text-white hover:bg-white/8 transition-colors">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Status */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold px-3 py-1 rounded-full" style={{ background: st.bg, color: st.text }}>{st.label}</span>
          {entry.identifier && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-lg" style={{ background: 'rgba(56,189,248,0.10)', color: '#38bdf8' }}>
              {entry.identifier}
            </span>
          )}
        </div>

        {/* Guest */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-3 py-2 border-b" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Guest</p>
          </div>
          <div className="px-3 py-3">
            {entry.guest ? (
              <>
                <p className="text-sm font-bold text-white">{entry.guest.firstName} {entry.guest.lastName}</p>
                <p className="text-[12px] mt-0.5" style={{ color: '#64748b' }}>{entry.guest.phone}</p>
              </>
            ) : (
              <p className="text-sm" style={{ color: '#64748b' }}>Walk-in guest</p>
            )}
          </div>
        </div>

        {/* Pass & Party */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-3 py-2 border-b" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Pass & Party</p>
          </div>
          {[
            { l: 'Pass', v: entry.passType.name },
            { l: 'Class', v: entry.passType.guestClass },
            { l: 'Party size', v: `${entry.guestCount} guest${entry.guestCount !== 1 ? 's' : ''}` },
            { l: 'Rate', v: formatMoney(Number(entry.passType.price), entry.passType.currency) + (entry.guestCount > 1 ? ` × ${entry.guestCount}` : '') },
          ].map(({ l, v }) => (
            <div key={l} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <span className="text-[11px]" style={{ color: '#64748b' }}>{l}</span>
              <span className="text-[12px] font-semibold text-white">{v}</span>
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="px-3 py-2 border-b" style={{ background: 'rgba(255,255,255,0.03)', borderColor: 'rgba(255,255,255,0.07)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: '#475569' }}>Timeline</p>
          </div>
          {[
            { l: 'Created', v: formatDateTime(entry.createdAt) },
            { l: 'Admitted', v: entry.admittedAt ? formatDateTime(entry.admittedAt) : '—' },
            { l: 'Exited', v: entry.exitedAt ? formatDateTime(entry.exitedAt) : '—' },
            { l: 'Duration', v: entry.admittedAt ? formatDuration(entry.admittedAt, entry.exitedAt) : '—' },
          ].map(({ l, v }) => (
            <div key={l} className="flex items-center justify-between px-3 py-2 border-b last:border-b-0" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
              <span className="text-[11px]" style={{ color: '#64748b' }}>{l}</span>
              <span className="text-[12px] font-semibold text-white">{v}</span>
            </div>
          ))}
        </div>

        {/* POS Order */}
        {entry.posOrder && (
          <div className="rounded-xl p-3" style={{ border: '1px solid rgba(56,189,248,0.14)', background: 'rgba(56,189,248,0.06)' }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#475569' }}>POS Order</p>
            <p className="text-sm font-bold text-white">{entry.posOrder.orderNumber}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm font-black" style={{ color: '#38bdf8' }}>{formatMoney(Number(entry.posOrder.total))}</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: entry.posOrder.paymentStatus === 'PAID' ? 'rgba(52,211,153,0.15)' : 'rgba(245,158,11,0.15)', color: entry.posOrder.paymentStatus === 'PAID' ? '#34d399' : '#fcd34d' }}>
                {entry.posOrder.paymentStatus}
              </span>
            </div>
          </div>
        )}

        {/* Resources */}
        {entry.resourceBookings.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1.5" style={{ color: '#475569' }}>Resources</p>
            <div className="space-y-1">
              {entry.resourceBookings.map((rb, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <span className="text-[12px] text-white">{rb.resource.name}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(56,189,248,0.12)', color: '#7dd3fc' }}>{rb.resource.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {entry.notes && (
          <div className="p-3 rounded-xl text-[12px]" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: '#94a3b8' }}>
            {entry.notes}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-5 py-4 border-t shrink-0 space-y-2" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {entry.status === 'RESERVED' && (
          <button
            onClick={onCheckin}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-50"
            style={{ background: 'rgba(52,211,153,0.18)', color: '#34d399', border: '1px solid rgba(52,211,153,0.28)' }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
            Check In
          </button>
        )}
        {entry.status === 'ACTIVE' && (
          <button
            onClick={onCheckout}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black transition-all disabled:opacity-50"
            style={{ background: 'rgba(56,189,248,0.15)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.28)' }}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
            Check Out
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdmissionsPage() {
  const [entries, setEntries] = useState<PoolEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState('');
  const [selected, setSelected] = useState<PoolEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const searchTimer = useRef<NodeJS.Timeout | null>(null);
  const LIMIT = 50;

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedSearch(search), 300);
  }, [search]);

  const facilityId = typeof window !== 'undefined' ? localStorage.getItem('pool_facility_id') : null;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (facilityId) params.set('facilityId', facilityId);
      if (statusFilter.length) params.set('status', statusFilter.join(','));
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (dateFilter) params.set('from', dateFilter);
      params.set('page', String(page));
      params.set('limit', String(LIMIT));
      const res = await fetch(`${POOL_API}/admissions?${params.toString()}`);
      const json = await res.json();
      setEntries(json.data?.entries ?? []);
      setTotal(json.data?.total ?? 0);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [facilityId, statusFilter, debouncedSearch, dateFilter, page]);

  useEffect(() => { load(); }, [load]);

  const doAction = async (entryId: string, action: 'checkin' | 'checkout') => {
    setBusy(true);
    try {
      const res = await fetch(`${POOL_API}/entries/${entryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json();
        alert(j.error || `${action} failed`);
      } else {
        await load();
        // Update selected
        const updated = await fetch(`${POOL_API}/admissions?search=${entryId.slice(0, 8)}`);
        const j = await updated.json();
        const refreshed = (j.data?.entries ?? []).find((e: PoolEntry) => e.id === entryId);
        if (refreshed) setSelected(refreshed);
      }
    } finally { setBusy(false); }
  };

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="flex h-full" style={{ minHeight: 0 }}>
      {/* Table area */}
      <div className={`flex flex-col ${selected ? 'hidden xl:flex' : 'flex'} flex-1 min-w-0`}>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.08)', background: 'rgba(6,11,19,0.60)' }}>
          <div className="relative flex-1" style={{ minWidth: 160 }}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: '#475569' }} />
            <input
              type="text"
              placeholder="Search name, wristband, entry #…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-sm"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#f8fafc' }}
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {STATUSES.map((s) => {
              const st = ENTRY_STATUS_STYLES[s as keyof typeof ENTRY_STATUS_STYLES];
              const active = statusFilter.includes(s);
              return (
                <button
                  key={s}
                  onClick={() => setStatusFilter(active ? statusFilter.filter(x => x !== s) : [...statusFilter, s])}
                  className="text-[10px] font-bold px-2 py-1 rounded-full transition-all"
                  style={{
                    background: active ? st.bg : 'rgba(255,255,255,0.05)',
                    color: active ? st.text : '#64748b',
                    border: `1px solid ${active ? st.text + '44' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {st.label}
                </button>
              );
            })}
          </div>

          {/* Date filter */}
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5" style={{ color: '#475569' }} />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
              className="px-2 py-1.5 rounded-lg text-[12px]"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: '#94a3b8' }}
            />
          </div>

          <button onClick={load} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6 transition-colors ml-auto">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Count */}
        <div className="px-4 py-2 flex items-center justify-between border-b" style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
          <p className="text-[11px]" style={{ color: '#475569' }}>
            {loading ? 'Loading…' : `${total} admission${total !== 1 ? 's' : ''}`}
          </p>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1 || loading} className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white disabled:opacity-30">
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px]" style={{ color: '#64748b' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages || loading} className="w-6 h-6 rounded flex items-center justify-center text-slate-500 hover:text-white disabled:opacity-30">
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#38bdf8' }} />
            </div>
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <Ticket className="w-8 h-8 opacity-20" style={{ color: '#38bdf8' }} />
              <p className="text-sm" style={{ color: '#475569' }}>No admissions found</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10">
                <tr>
                  {['#', 'Guest', 'Pass', 'Party', 'Time In', 'Status', ''].map((h) => (
                    <th key={h} className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider" style={{ color: '#475569' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const st = ENTRY_STATUS_STYLES[e.status as keyof typeof ENTRY_STATUS_STYLES] ?? { bg: 'rgba(100,116,139,0.14)', text: '#94a3b8', label: e.status };
                  const isSelected = selected?.id === e.id;
                  return (
                    <tr
                      key={e.id}
                      onClick={() => setSelected(isSelected ? null : e)}
                      className="pool-entry-row cursor-pointer"
                      style={{ background: isSelected ? 'rgba(56,189,248,0.06)' : undefined }}
                    >
                      <td className="px-3 py-2.5">
                        <p className="text-[11px] font-mono" style={{ color: '#64748b' }}>{e.entryNumber.slice(-8)}</p>
                        {e.identifier && <p className="text-[10px] font-bold mt-0.5" style={{ color: '#38bdf8' }}>{e.identifier}</p>}
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="font-semibold text-white truncate max-w-[120px]">
                          {e.guest ? `${e.guest.firstName} ${e.guest.lastName}` : 'Walk-in'}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-[12px] truncate max-w-[100px]" style={{ color: '#94a3b8' }}>{e.passType.name}</p>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className="text-sm font-bold text-white">{e.guestCount}</span>
                      </td>
                      <td className="px-3 py-2.5">
                        <p className="text-[12px]" style={{ color: '#64748b' }}>
                          {e.admittedAt ? formatDateTime(e.admittedAt) : '—'}
                        </p>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.text }}>
                          {st.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          {e.status === 'RESERVED' && (
                            <button
                              onClick={(ev) => { ev.stopPropagation(); doAction(e.id, 'checkin'); }}
                              disabled={busy}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors"
                              style={{ background: 'rgba(52,211,153,0.14)', color: '#34d399' }}
                            >
                              <CheckCircle2 className="w-3 h-3" /> In
                            </button>
                          )}
                          {e.status === 'ACTIVE' && (
                            <button
                              onClick={(ev) => { ev.stopPropagation(); doAction(e.id, 'checkout'); }}
                              disabled={busy}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold transition-colors"
                              style={{ background: 'rgba(56,189,248,0.12)', color: '#38bdf8' }}
                            >
                              <XCircle className="w-3 h-3" /> Out
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-full xl:w-80 shrink-0 overflow-hidden">
          <EntryDetailPanel
            entry={selected}
            onClose={() => setSelected(null)}
            onCheckout={() => doAction(selected.id, 'checkout')}
            onCheckin={() => doAction(selected.id, 'checkin')}
            busy={busy}
          />
        </div>
      )}
    </div>
  );
}
