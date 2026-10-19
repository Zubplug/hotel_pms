'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  ScanLine, Search, CheckCircle2, XCircle, Loader2,
  User, UserCheck, UserX, Clock, RefreshCw, Waves,
  AlertTriangle, Info, Keyboard,
} from 'lucide-react';
import {
  formatDateTime, formatMoney, ENTRY_STATUS_STYLES,
  POOL_API, evaluateSafetyGate, newOperationId,
} from '../_components/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

interface PoolEntry {
  id: string;
  entryNumber: string;
  identifier: string | null;
  status: string;
  guestCount: number;
  admittedAt: string | null;
  exitedAt: string | null;
  createdAt: string;
  waiverAccepted: boolean;
  notes: string | null;
  guest: { firstName: string; lastName: string; phone: string } | null;
  passType: { name: string; code: string; guestClass: string; price: number; currency: string };
  facility: { name: string; status: string; capacity: number } | null;
}

interface LookupResult {
  type: 'found' | 'not_found' | 'already_out' | 'error';
  entry?: PoolEntry;
  message?: string;
}

export default function CheckInPage() {
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<'success' | 'error' | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const facilityId = typeof window !== 'undefined' ? localStorage.getItem('pool_facility_id') : null;

  // Auto-focus input
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Reset flash
  useEffect(() => {
    if (flash) { const t = setTimeout(() => setFlash(null), 2000); return () => clearTimeout(t); }
  }, [flash]);

  const lookup = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const params = new URLSearchParams({ search: q.trim(), limit: '5' });
      if (facilityId) params.set('facilityId', facilityId);
      const allEntries: PoolEntry[] = isDesktopMode
        ? ((await provider.pool.getSnapshot('', facilityId)).data?.entries ?? [])
        : await (async () => {
            const res = await fetch(`${POOL_API}/admissions?${params.toString()}`);
            const json = await res.json();
            return json.data?.entries ?? [];
          })();
      const normalizedQuery = q.trim().toLowerCase();
      const entries = allEntries.filter((entry) =>
        !isDesktopMode
        || `${entry.entryNumber} ${entry.identifier || ''} ${entry.guest?.firstName || ''} ${entry.guest?.lastName || ''} ${entry.passType?.code || ''}`
          .toLowerCase()
          .includes(normalizedQuery)
      );

      if (entries.length === 0) {
        setResult({ type: 'not_found', message: `No admission found for "${q}"` });
        return;
      }

      // Prefer active/reserved; otherwise show first
      const entry = entries.find(e => e.status === 'RESERVED' || e.status === 'ACTIVE') ?? entries[0];

      if (entry.status === 'COMPLETED') {
        setResult({ type: 'already_out', entry, message: 'This guest has already checked out.' });
      } else {
        setResult({ type: 'found', entry });
      }
    } catch {
      setResult({ type: 'error', message: 'Lookup failed. Check network and retry.' });
    } finally {
      setBusy(false);
    }
  }, [facilityId, isDesktopMode, provider.pool]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { lookup(query); }
  };

  const doAction = async (entry: PoolEntry, action: 'checkin' | 'checkout') => {
    setBusy(true);
    try {
      if (isDesktopMode) {
        const response = await provider.pool.updateEntryStatus(entry.id, action === 'checkin' ? 'ACTIVE' : 'COMPLETED');
        if (response?.success === false) {
          setResult({ type: 'error', message: response.error || `${action} failed` });
          setFlash('error');
        } else {
          setFlash('success'); setResult(null); setQuery('');
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      } else {
        const res = await fetch(`${POOL_API}/entries/${entry.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
        if (!res.ok) {
          const j = await res.json();
          setResult({ type: 'error', message: j.error || `${action} failed` });
          setFlash('error');
        } else {
          setFlash('success'); setResult(null); setQuery('');
          setTimeout(() => inputRef.current?.focus(), 100);
        }
      }
    } catch {
      setResult({ type: 'error', message: 'Action failed. Please retry.' });
      setFlash('error');
    } finally {
      setBusy(false);
    }
  };

  const st = result?.entry
    ? ENTRY_STATUS_STYLES[result.entry.status as keyof typeof ENTRY_STATUS_STYLES] ?? { bg: 'rgba(100,116,139,0.14)', text: '#94a3b8', label: result.entry.status }
    : null;

  return (
    <div className="flex flex-col items-center justify-start pt-8 px-4 pb-4" style={{ minHeight: '100%' }}>
      {/* Header */}
      <div className="w-full max-w-lg mb-6 text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{ background: 'rgba(56,189,248,0.14)' }}>
          <ScanLine className="w-6 h-6" style={{ color: '#38bdf8' }} />
        </div>
        <h2 className="text-xl font-black text-white">Quick Check-In / Out</h2>
        <p className="text-[13px] mt-1" style={{ color: '#64748b' }}>
          Scan or type a wristband ID, entry number, or guest name and press Enter.
        </p>
      </div>

      {/* Flash feedback */}
      {flash && (
        <div
          className="w-full max-w-lg mb-4 flex items-center gap-2 px-4 py-3 rounded-xl font-bold text-sm"
          style={{
            background: flash === 'success' ? 'rgba(52,211,153,0.18)' : 'rgba(244,63,94,0.18)',
            border: `1px solid ${flash === 'success' ? 'rgba(52,211,153,0.35)' : 'rgba(244,63,94,0.35)'}`,
            color: flash === 'success' ? '#34d399' : '#fda4af',
          }}
        >
          {flash === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {flash === 'success' ? 'Done! Ready for next guest.' : 'Action failed.'}
        </div>
      )}

      {/* Search input */}
      <div className="w-full max-w-lg">
        <div className="relative">
          <Keyboard className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#475569' }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Wristband ID, entry number, guest name…"
            className="w-full pl-11 pr-4 py-4 rounded-2xl text-base font-medium"
            style={{
              background: '#0d1724',
              border: `2px solid ${result?.type === 'found' ? 'rgba(56,189,248,0.35)' : result?.type === 'error' || result?.type === 'not_found' ? 'rgba(244,63,94,0.35)' : 'rgba(255,255,255,0.12)'}`,
              color: '#f8fafc',
              boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={() => lookup(query)}
            disabled={busy || !query.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: 'rgba(56,189,248,0.16)', color: '#38bdf8' }}
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          </button>
        </div>
        <p className="text-center text-[11px] mt-2" style={{ color: '#2d3748' }}>Press Enter or click Search · Auto-focus for barcode scanner</p>
      </div>

      {/* Result card */}
      {result && (
        <div className="w-full max-w-lg mt-5">
          {result.type === 'not_found' && (
            <div className="rounded-2xl p-6 text-center" style={{ border: '1px solid rgba(245,158,11,0.25)', background: 'rgba(245,158,11,0.07)' }}>
              <User className="w-8 h-8 mx-auto mb-2 opacity-40" style={{ color: '#f59e0b' }} />
              <p className="text-sm font-bold" style={{ color: '#fcd34d' }}>Not Found</p>
              <p className="text-[12px] mt-1" style={{ color: '#64748b' }}>{result.message}</p>
            </div>
          )}

          {result.type === 'error' && (
            <div className="rounded-2xl p-6 text-center" style={{ border: '1px solid rgba(244,63,94,0.25)', background: 'rgba(244,63,94,0.07)' }}>
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" style={{ color: '#ef4444' }} />
              <p className="text-sm font-bold" style={{ color: '#fda4af' }}>Error</p>
              <p className="text-[12px] mt-1" style={{ color: '#64748b' }}>{result.message}</p>
            </div>
          )}

          {(result.type === 'found' || result.type === 'already_out') && result.entry && (
            <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${st?.text}33`, background: '#0d1724', boxShadow: '0 12px 40px rgba(0,0,0,0.35)' }}>
              {/* Status bar */}
              <div className="px-5 py-2.5 flex items-center justify-between" style={{ background: `${st?.bg}` }}>
                <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: st?.text }}>{st?.label}</span>
                {result.entry.identifier && (
                  <span className="text-[11px] font-mono font-bold" style={{ color: st?.text }}>#{result.entry.identifier}</span>
                )}
              </div>

              {/* Entry info */}
              <div className="px-5 py-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-base font-black shrink-0" style={{ background: 'rgba(56,189,248,0.14)', color: '#38bdf8' }}>
                    {result.entry.guest ? `${result.entry.guest.firstName[0]}${result.entry.guest.lastName[0]}` : '?'}
                  </div>
                  <div>
                    <p className="text-base font-black text-white">
                      {result.entry.guest ? `${result.entry.guest.firstName} ${result.entry.guest.lastName}` : 'Walk-in Guest'}
                    </p>
                    {result.entry.guest && <p className="text-[12px]" style={{ color: '#64748b' }}>{result.entry.guest.phone}</p>}
                    <p className="text-[11px] font-mono mt-0.5" style={{ color: '#475569' }}>{result.entry.entryNumber}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { l: 'Pass', v: result.entry.passType.name },
                    { l: 'Party', v: `${result.entry.guestCount} guest${result.entry.guestCount !== 1 ? 's' : ''}` },
                    { l: 'Rate', v: formatMoney(Number(result.entry.passType.price), result.entry.passType.currency) },
                    { l: 'Admitted', v: result.entry.admittedAt ? formatDateTime(result.entry.admittedAt) : '—' },
                  ].map(({ l, v }) => (
                    <div key={l} className="px-3 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wider mb-0.5" style={{ color: '#475569' }}>{l}</p>
                      <p className="text-[13px] font-bold text-white">{v}</p>
                    </div>
                  ))}
                </div>

                {result.type === 'already_out' && (
                  <div className="flex items-center gap-2 p-3 rounded-xl mb-3 text-[12px]" style={{ background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.22)', color: '#fcd34d' }}>
                    <Info className="w-4 h-4 shrink-0" />
                    {result.message}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  {result.entry.status === 'RESERVED' && (
                    <button
                      onClick={() => doAction(result.entry!, 'checkin')}
                      disabled={busy}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all"
                      style={{ background: 'rgba(52,211,153,0.18)', color: '#34d399', border: '1px solid rgba(52,211,153,0.30)' }}
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                      Admit / Check In
                    </button>
                  )}
                  {result.entry.status === 'ACTIVE' && (
                    <button
                      onClick={() => doAction(result.entry!, 'checkout')}
                      disabled={busy}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-sm transition-all"
                      style={{ background: 'rgba(56,189,248,0.16)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.30)' }}
                    >
                      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserX className="w-4 h-4" />}
                      Check Out
                    </button>
                  )}
                  <button
                    onClick={() => { setResult(null); setQuery(''); inputRef.current?.focus(); }}
                    className="px-4 py-3 rounded-xl text-sm font-bold transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state tips */}
      {!result && !busy && (
        <div className="w-full max-w-lg mt-6 grid grid-cols-3 gap-3">
          {[
            { icon: ScanLine, tip: 'Scan barcode', sub: 'USB or Bluetooth scanner auto-submits' },
            { icon: Keyboard, tip: 'Type manually', sub: 'Entry #, wristband ID, or guest name' },
            { icon: Clock, tip: 'Quick actions', sub: 'Check in RESERVED, check out ACTIVE' },
          ].map(({ icon: Icon, tip, sub }) => (
            <div key={tip} className="rounded-xl p-3 text-center" style={{ border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
              <Icon className="w-5 h-5 mx-auto mb-1.5 opacity-30" style={{ color: '#38bdf8' }} />
              <p className="text-[11px] font-bold text-white">{tip}</p>
              <p className="text-[10px] mt-0.5" style={{ color: '#475569' }}>{sub}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
