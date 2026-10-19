'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Plus, AlertTriangle, RefreshCw, Loader2,
  Check, X, ChevronDown, Droplets, ThermometerSun,
  BadgeAlert, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import {
  SAFETY_STATUS_STYLES, INCIDENT_STATUS_STYLES, INCIDENT_SEVERITY_STYLES,
  formatDateTime, evaluateSafetyGate,
} from '../_components/utils';
import { useLodgeCoreProvider } from '@/lib/desktop/DataProviderContext';

interface SafetyCheck {
  id: string;
  checkType: string;
  status: string;
  chlorine: number | null;
  ph: number | null;
  notes: string | null;
  checkedAt: string;
  checkedBy: string | null;
}

interface Incident {
  id: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  createdAt: string;
  resolvedAt: string | null;
  entryId: string | null;
}

const CHECK_TYPES = ['OPENING', 'WATER_QUALITY', 'LIFEGUARD', 'CLOSING'];
const SEVERITY_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

// ─── Safety check form ────────────────────────────────────────────────────────

function SafetyCheckDialog({ facilityId, onClose, onSuccess }: {
  facilityId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { provider } = useLodgeCoreProvider();
  const [form, setForm] = useState({
    checkType: 'WATER_QUALITY',
    status: 'PASS',
    chlorine: '',
    ph: '',
    notes: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const result = await provider.pool.applyOperation('safety_check', { facilityId, checkType: form.checkType, status: form.status, chlorine: form.chlorine ? Number(form.chlorine) : undefined, ph: form.ph ? Number(form.ph) : undefined, notes: form.notes || undefined });
      if (result?.success === false) throw new Error(result.error || 'Failed');
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally { setBusy(false); }
  };

  const statusOpts = [
    { v: 'PASS', l: 'Pass ✓', colour: '#34d399' },
    { v: 'ATTENTION', l: 'Attention ⚠', colour: '#fcd34d' },
    { v: 'FAILED', l: 'Failed ✕', colour: '#fda4af' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(2,6,23,0.82)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden" style={{ background: '#0d1724', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 28px 90px rgba(0,0,0,0.55)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.09)' }}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" style={{ color: '#38bdf8' }} />
            <h3 className="text-sm font-black text-white">New Safety Check</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {err && <div className="text-[12px] p-3 rounded-xl" style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', color: '#fda4af' }}>{err}</div>}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Check Type</label>
            <div className="grid grid-cols-2 gap-1.5">
              {CHECK_TYPES.map((t) => (
                <button
                  key={t}
                  onClick={() => set('checkType', t)}
                  className="py-2 rounded-xl text-[11px] font-bold transition-colors"
                  style={{
                    background: form.checkType === t ? 'rgba(56,189,248,0.15)' : 'rgba(255,255,255,0.04)',
                    color: form.checkType === t ? '#38bdf8' : '#64748b',
                    border: `1px solid ${form.checkType === t ? 'rgba(56,189,248,0.28)' : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {t.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1.5" style={{ color: '#475569' }}>Result</label>
            <div className="grid grid-cols-3 gap-1.5">
              {statusOpts.map(({ v, l, colour }) => (
                <button
                  key={v}
                  onClick={() => set('status', v)}
                  className="py-2 rounded-xl text-[11px] font-bold transition-colors"
                  style={{
                    background: form.status === v ? `${colour}1a` : 'rgba(255,255,255,0.04)',
                    color: form.status === v ? colour : '#64748b',
                    border: `1px solid ${form.status === v ? `${colour}44` : 'rgba(255,255,255,0.08)'}`,
                  }}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
                <Droplets className="inline w-3 h-3 mr-1" />Chlorine (ppm)
              </label>
              <input type="number" step="0.1" placeholder="e.g. 1.5" value={form.chlorine} onChange={(e) => set('chlorine', e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>
                <ThermometerSun className="inline w-3 h-3 mr-1" />pH Level
              </label>
              <input type="number" step="0.1" placeholder="e.g. 7.2" value={form.ph} onChange={(e) => set('ph', e.target.value)} className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Notes</label>
            <textarea rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Observations, corrective actions…" className="w-full px-3 py-2 rounded-xl text-sm resize-none" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>Cancel</button>
          <button onClick={submit} disabled={busy} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black" style={{ background: 'rgba(52,211,153,0.18)', color: '#34d399' }}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Submit
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Incident form ─────────────────────────────────────────────────────────────

function IncidentDialog({ facilityId, onClose, onSuccess }: {
  facilityId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { provider } = useLodgeCoreProvider();
  const [form, setForm] = useState({ title: '', description: '', severity: 'LOW' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.title.trim() || !form.description.trim()) { setErr('Title and description are required'); return; }
    setBusy(true); setErr(null);
    try {
      const result = await provider.pool.applyOperation('incident', { facilityId, title: form.title, description: form.description, severity: form.severity });
      if (result?.success === false) throw new Error(result.error || 'Failed');
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Failed');
    } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(2,6,23,0.82)', backdropFilter: 'blur(6px)' }}>
      <div className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden" style={{ background: '#0d1724', border: '1px solid rgba(244,63,94,0.22)', boxShadow: '0 28px 90px rgba(0,0,0,0.55)' }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'rgba(244,63,94,0.15)' }}>
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" style={{ color: '#fda4af' }} />
            <h3 className="text-sm font-black text-white">Report Incident</h3>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/8">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          {err && <div className="text-[12px] p-3 rounded-xl" style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.25)', color: '#fda4af' }}>{err}</div>}

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Severity</label>
            <div className="grid grid-cols-4 gap-1">
              {SEVERITY_LEVELS.map((s) => {
                const sev = INCIDENT_SEVERITY_STYLES[s as keyof typeof INCIDENT_SEVERITY_STYLES];
                return (
                  <button
                    key={s}
                    onClick={() => set('severity', s)}
                    className="py-1.5 rounded-xl text-[10px] font-black transition-colors"
                    style={{
                      background: form.severity === s ? sev.bg : 'rgba(255,255,255,0.04)',
                      color: form.severity === s ? sev.text : '#475569',
                      border: `1px solid ${form.severity === s ? `${sev.dot}44` : 'rgba(255,255,255,0.07)'}`,
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Title</label>
            <input type="text" value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Brief incident title" className="w-full px-3 py-2 rounded-xl text-sm" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} autoFocus />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: '#475569' }}>Description</label>
            <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Describe what happened, who is involved, and immediate actions taken…" className="w-full px-3 py-2 rounded-xl text-sm resize-none" style={{ background: '#0a1220', border: '1px solid rgba(255,255,255,0.12)', color: '#f8fafc' }} />
          </div>
        </div>
        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}>Cancel</button>
          <button onClick={submit} disabled={busy} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-black" style={{ background: 'rgba(244,63,94,0.18)', color: '#fda4af' }}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
            Report
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function SafetyPage() {
  const { provider, isDesktopMode } = useLodgeCoreProvider();
  const [pageData, setPageData] = useState<{
    facility: { id: string; name: string; status: string; capacity: number } | null;
    incidents: Incident[];
    safetyChecks: SafetyCheck[];
    latestSafety: SafetyCheck | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showSafetyForm, setShowSafetyForm] = useState(false);
  const [showIncidentForm, setShowIncidentForm] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);
  const facilityId = typeof window !== 'undefined' ? localStorage.getItem('pool_facility_id') : null;

  const load = useCallback(async () => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const snapshot = isDesktopMode
        ? await provider.pool.getSnapshot('', facilityId)
        : await (async () => {
            const [mainRes, reportRes] = await Promise.all([
              fetch(`/api/v1/pos/swimming-pool?${facilityId ? `facilityId=${facilityId}` : ''}`),
              fetch(`/api/v1/pos/swimming-pool/reports?from=${today}&to=${today}${facilityId ? `&facilityId=${facilityId}` : ''}`),
            ]);
            const main = await mainRes.json();
            const report = await reportRes.json();
            return { data: { ...main.data, safetyChecks: report.data?.safetyChecks ?? [] } };
          })();
      const d = snapshot.data;
      const safetyChecks = (d?.safetyChecks ?? []).filter((check: SafetyCheck) => String(check.checkedAt).slice(0, 10) === today);

      setPageData({
        facility: d?.facility ?? d?.facilities?.[0] ?? null,
        incidents: d?.incidents ?? [],
        safetyChecks,
        latestSafety: d?.latestSafety ?? safetyChecks[0] ?? null,
      });
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [facilityId, isDesktopMode, provider.pool]);

  useEffect(() => { load(); }, [load]);

  const updateIncident = async (id: string, status: string) => {
    setUpdating(id);
    try {
      const result = await provider.pool.applyOperation('update_incident', { id, status });
      if (result?.success === false) alert(result.error || 'Update failed');
      else await load();
    } finally { setUpdating(null); }
  };

  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#38bdf8' }} />
    </div>
  );

  const d = pageData;
  if (!d) return null;

  const gate = evaluateSafetyGate({
    facilityStatus: (d.facility?.status ?? 'OPEN') as 'OPEN' | 'CLOSED' | 'MAINTENANCE' | 'WEATHER_HOLD',
    latestSafetyCheck: d.latestSafety ? { status: d.latestSafety.status as 'PASS' | 'ATTENTION' | 'FAILED', checkType: d.latestSafety.checkType, checkedAt: d.latestSafety.checkedAt } : null,
    openIncidents: d.incidents.map(i => ({ severity: i.severity as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' })),
  });

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Gate banner */}
      {gate.warning && (
        <div className={`pool-gate-banner ${gate.blocked ? 'danger' : 'warning'}`}>
          {gate.blocked ? <X className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {gate.warning}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <h2 className="text-sm font-black text-white flex-1">Safety & Incidents</h2>
        <button onClick={() => setShowSafetyForm(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-colors" style={{ background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.25)' }}>
          <ShieldCheck className="w-3.5 h-3.5" /> Safety Check
        </button>
        <button onClick={() => setShowIncidentForm(true)} className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-colors" style={{ background: 'rgba(244,63,94,0.14)', color: '#fda4af', border: '1px solid rgba(244,63,94,0.25)' }}>
          <AlertTriangle className="w-3.5 h-3.5" /> Report Incident
        </button>
        <button onClick={load} className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/6">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Safety checks */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(13,23,36,0.60)' }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <ShieldCheck className="w-4 h-4" style={{ color: '#34d399' }} />
            <span className="text-sm font-bold text-white">Safety Checks</span>
            <span className="text-[11px] ml-auto" style={{ color: '#475569' }}>Today</span>
          </div>

          {d.safetyChecks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <ShieldCheck className="w-8 h-8 opacity-15" style={{ color: '#34d399' }} />
              <p className="text-sm" style={{ color: '#475569' }}>No safety checks recorded today</p>
              <button onClick={() => setShowSafetyForm(true)} className="text-[11px] font-bold mt-1" style={{ color: '#34d399' }}>
                Record first check →
              </button>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {d.safetyChecks.map((c) => {
                const ss = SAFETY_STATUS_STYLES[c.status as keyof typeof SAFETY_STATUS_STYLES];
                return (
                  <div key={c.id} className="px-4 py-3 flex items-start gap-3">
                    <span className="text-sm mt-0.5" style={{ color: ss?.text ?? '#94a3b8' }}>{ss?.icon ?? '?'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black uppercase tracking-wider" style={{ color: ss?.text ?? '#94a3b8' }}>{ss?.label}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)', color: '#64748b' }}>{c.checkType}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px]" style={{ color: '#475569' }}>
                        {c.chlorine != null && <span><Droplets className="inline w-3 h-3 mr-0.5" />Cl: {c.chlorine}</span>}
                        {c.ph != null && <span>pH: {c.ph}</span>}
                        <span className="ml-auto">{formatDateTime(c.checkedAt)}</span>
                      </div>
                      {c.notes && <p className="text-[11px] mt-0.5" style={{ color: '#64748b' }}>{c.notes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Incidents */}
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)', background: 'rgba(13,23,36,0.60)' }}>
          <div className="flex items-center gap-2 px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <BadgeAlert className="w-4 h-4" style={{ color: '#fda4af' }} />
            <span className="text-sm font-bold text-white">Open Incidents</span>
            {d.incidents.length > 0 && (
              <span className="ml-1 text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(244,63,94,0.18)', color: '#fda4af' }}>
                {d.incidents.length}
              </span>
            )}
          </div>

          {d.incidents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <CheckCircle2 className="w-8 h-8" style={{ color: '#34d399', opacity: 0.4 }} />
              <p className="text-sm" style={{ color: '#475569' }}>No open incidents</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              {d.incidents.map((inc) => {
                const sev = INCIDENT_SEVERITY_STYLES[inc.severity as keyof typeof INCIDENT_SEVERITY_STYLES];
                const ist = INCIDENT_STATUS_STYLES[inc.status as keyof typeof INCIDENT_STATUS_STYLES];
                return (
                  <div key={inc.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ background: sev?.dot ?? '#ef4444' }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-white">{inc.title}</p>
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full" style={{ background: sev?.bg, color: sev?.text }}>{inc.severity}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: ist?.bg, color: ist?.text }}>{ist?.label}</span>
                        </div>
                        <p className="text-[12px] mt-0.5" style={{ color: '#64748b' }}>{inc.description}</p>
                        <p className="text-[10px] mt-1" style={{ color: '#475569' }}>{formatDateTime(inc.createdAt)}</p>
                      </div>
                    </div>

                    {/* Status actions */}
                    <div className="flex items-center gap-1.5 ml-4">
                      {inc.status === 'OPEN' && (
                        <button
                          onClick={() => updateIncident(inc.id, 'INVESTIGATING')}
                          disabled={updating === inc.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors"
                          style={{ background: 'rgba(249,115,22,0.14)', color: '#fb923c' }}
                        >
                          {updating === inc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Clock className="w-3 h-3" />}
                          Investigating
                        </button>
                      )}
                      {(inc.status === 'OPEN' || inc.status === 'INVESTIGATING') && (
                        <button
                          onClick={() => updateIncident(inc.id, 'RESOLVED')}
                          disabled={updating === inc.id}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors"
                          style={{ background: 'rgba(52,211,153,0.14)', color: '#34d399' }}
                        >
                          {updating === inc.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                          Resolve
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      {showSafetyForm && d.facility && (
        <SafetyCheckDialog facilityId={d.facility.id} onClose={() => setShowSafetyForm(false)} onSuccess={() => { setShowSafetyForm(false); load(); }} />
      )}
      {showIncidentForm && d.facility && (
        <IncidentDialog facilityId={d.facility.id} onClose={() => setShowIncidentForm(false)} onSuccess={() => { setShowIncidentForm(false); load(); }} />
      )}
    </div>
  );
}
