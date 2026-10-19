/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowUpFromLine, CheckCircle2, ChevronDown, ClipboardCheck, Droplets, Loader2, Plus, Search, ShieldCheck, Ticket, Users, Waves, X } from 'lucide-react';
import PoolOperationsPanels from './PoolOperationsPanels';
import { TerminalAuthScreen } from '@/components/pos/TerminalAuthScreen';

const money = (value: number, currency = 'NGN') => new Intl.NumberFormat('en-NG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value || 0);

export default function SwimmingPoolPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [facilityId, setFacilityId] = useState('');
  const [showAdmission, setShowAdmission] = useState(false);
  const [showSafety, setShowSafety] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [search, setSearch] = useState('');
  const [guestSearch, setGuestSearch] = useState('');
  const [selectedGuest, setSelectedGuest] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [setupForm, setSetupForm] = useState({ name: '', code: 'MAIN-POOL', capacity: 50 });
  const [safetyForm, setSafetyForm] = useState({ checkType: 'OPENING', status: 'PASS', chlorine: '', ph: '', notes: '' });
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ passTypeId: '', identifier: '', guestCount: 1, folioId: '', notes: '', paymentMethod: 'CASH', waiverAccepted: false });
  const [bankingModel, setBankingModel] = useState('CENTRAL_CASHIER');
  const [showOperatorAuth, setShowOperatorAuth] = useState(false);

  const load = useCallback(async (query = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (facilityId) params.set('facilityId', facilityId);
      if (query) params.set('search', query);
      const res = await fetch(`/api/v1/pos/swimming-pool?${params.toString()}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Could not load pool operations');
      setData(json.data);
      setBankingModel(String(json.data.bankingModel || 'CENTRAL_CASHIER').toUpperCase());
      if (!facilityId && json.data.facility?.id) setFacilityId(json.data.facility.id);
    } catch (err: any) { setError(err.message || 'Could not load pool operations'); }
    finally { setLoading(false); }
  }, [facilityId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (bankingModel !== 'SERVER_BANKING' || typeof window === 'undefined') return;
    if (!localStorage.getItem('lodgecore_pos_operator_token')) setShowOperatorAuth(true);
  }, [bankingModel]);
  useEffect(() => { const timer = setTimeout(() => { if (guestSearch.length >= 2) load(guestSearch); }, 300); return () => clearTimeout(timer); }, [guestSearch, load]);

  const facility = data?.facility;
  const passTypes = facility?.passTypes || [];
  const selectedPass = passTypes.find((pass: any) => pass.id === form.passTypeId);
  const utilization = facility?.capacity ? Math.min(100, Math.round((data.metrics.occupancy / facility.capacity) * 100)) : 0;
  const todayLabel = data?.businessDate ? new Date(data.businessDate).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'short' }) : 'Today';

  const submitAdmission = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!facility?.id || !form.passTypeId || !form.waiverAccepted) return;
    setSubmitting(true); setError('');
    try {
      const folioId = form.folioId || selectedGuest?.reservations?.[0]?.folios?.[0]?.id;
      let posOrderId: string | undefined;
      if (Number(selectedPass?.price || 0) > 0) {
        const sessionId = typeof window !== 'undefined' ? window.localStorage.getItem('lodgecore_pos_session_id') || undefined : undefined;
        const operatorToken = typeof window !== 'undefined' ? window.localStorage.getItem('lodgecore_pos_operator_token') || '' : '';
        if (bankingModel === 'SERVER_BANKING' && !operatorToken) { setShowOperatorAuth(true); throw new Error('Open the pool operator shift before accepting payment'); }
        const saleRes = await fetch('/api/v1/pos/swimming-pool', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(operatorToken ? { Authorization: `Bearer ${operatorToken}` } : {}) }, body: JSON.stringify({ action: 'sale', passTypeId: form.passTypeId, guestCount: Number(form.guestCount), guestId: selectedGuest?.id, reservationId: selectedGuest?.reservations?.[0]?.id, folioId, sessionId, method: form.paymentMethod, displayName: selectedGuest ? `${selectedGuest.firstName} ${selectedGuest.lastName}` : 'Walk-in pool guest', operationId: `POOL-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }) });
        const saleJson = await saleRes.json();
        if (!saleRes.ok) throw new Error(saleJson.error || 'Pool payment failed');
        posOrderId = saleJson.data.orderId;
      }
      const res = await fetch('/api/v1/pos/swimming-pool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'entry', facilityId: facility.id, passTypeId: form.passTypeId, guestId: selectedGuest?.id, reservationId: selectedGuest?.reservations?.[0]?.id, folioId, posOrderId, identifier: form.identifier || undefined, guestCount: Number(form.guestCount), notes: form.notes || undefined, waiverAccepted: true, admitNow: true }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Admission failed');
      setToast(`Admission ${json.data.entryNumber} created`); setShowAdmission(false); setSelectedGuest(null); setGuestSearch(''); setForm({ passTypeId: '', identifier: '', guestCount: 1, folioId: '', notes: '', paymentMethod: 'CASH', waiverAccepted: false }); await load();
    } catch (err: any) { setError(err.message || 'Admission failed'); }
    finally { setSubmitting(false); }
  };

  const transition = async (entryId: string, action: 'checkout' | 'checkin') => {
    const res = await fetch(`/api/v1/pos/swimming-pool/entries/${entryId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    const json = await res.json();
    if (!res.ok) setError(json.error || 'Update failed'); else { setToast(action === 'checkout' ? 'Guest checked out' : 'Guest checked in'); await load(); }
  };

  const submitSafety = async (event: React.FormEvent) => {
    event.preventDefault(); setSubmitting(true);
    try { const res = await fetch('/api/v1/pos/swimming-pool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'safety_check', facilityId: facility.id, ...safetyForm, chlorine: safetyForm.chlorine || undefined, ph: safetyForm.ph || undefined }) }); const json = await res.json(); if (!res.ok) throw new Error(json.error || 'Safety check failed'); setShowSafety(false); setToast('Safety check recorded'); await load(); } catch (err: any) { setError(err.message || 'Safety check failed'); } finally { setSubmitting(false); }
  };

  const submitSetup = async (event: React.FormEvent) => {
    event.preventDefault(); setSubmitting(true);
    try { const res = await fetch('/api/v1/pos/swimming-pool', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'setup', ...setupForm }) }); const json = await res.json(); if (!res.ok) throw new Error(json.error || 'Pool setup failed'); setShowSetup(false); setFacilityId(json.data.id); setToast('Pool facility configured'); await load(); } catch (err: any) { setError(err.message || 'Pool setup failed'); } finally { setSubmitting(false); }
  };

  const initials = (guest: any) => `${guest?.firstName?.[0] || ''}${guest?.lastName?.[0] || ''}`.toUpperCase() || 'W';
  const filteredEntries = useMemo(() => (data?.activeEntries || []).filter((entry: any) => `${entry.guest?.firstName || ''} ${entry.guest?.lastName || ''} ${entry.identifier || ''} ${entry.entryNumber}`.toLowerCase().includes(search.toLowerCase())), [data, search]);

  if (loading && !data) return <div className="min-h-screen bg-[#07111f] flex items-center justify-center text-slate-300"><Loader2 className="animate-spin mr-3" /> Loading pool operations…</div>;

  return <main className="h-full overflow-y-auto bg-[#07111f] text-slate-100 p-4 md:p-7">
    <div className="max-w-[1600px] mx-auto space-y-6">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="flex items-center gap-4"><div className="h-12 w-12 rounded-2xl bg-cyan-400/15 border border-cyan-300/20 flex items-center justify-center"><Waves className="text-cyan-300" /></div><div><div className="flex items-center gap-3"><h1 className="text-2xl md:text-3xl font-semibold tracking-tight">Pool operations</h1><span className="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-300">Live</span></div><p className="text-sm text-slate-400 mt-1">Admissions, access control and poolside service · {todayLabel}</p></div></div>
        <div className="flex flex-wrap items-center gap-3"><div className="relative"><select value={facility?.id || ''} onChange={(e) => setFacilityId(e.target.value)} className="appearance-none rounded-xl border border-white/10 bg-white/[0.06] pl-4 pr-10 py-2.5 text-sm text-slate-200 outline-none"><option value="">Select facility</option>{(data?.facilities || []).map((item: any) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-3 top-3.5 text-slate-400" /></div><button onClick={() => setShowAdmission(true)} className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 shadow-lg shadow-cyan-500/10 hover:bg-cyan-300"><Plus size={17} /> New admission</button></div>
      </header>

      {error && <div className="flex items-center justify-between rounded-xl border border-rose-400/25 bg-rose-400/10 px-4 py-3 text-sm text-rose-200"><span>{error}</span><button onClick={() => setError('')}><X size={16} /></button></div>}
      {toast && <div className="fixed right-5 top-5 z-50 rounded-xl border border-emerald-300/20 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200 shadow-xl" onClick={() => setToast('')}>{toast}</div>}

      {!facility ? <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-10 text-center"><Waves className="mx-auto mb-4 text-cyan-300" size={34} /><h2 className="text-xl font-semibold">No pool facility configured</h2><p className="mt-2 text-sm text-slate-400">Create a pool facility and pass types before opening admissions.</p><button onClick={() => setShowSetup(true)} className="mt-6 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950"><Plus size={16} className="inline mr-2" />Configure pool facility</button></div> : <>
        <section className="grid grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
          <Metric icon={<Users size={18} />} label="Live occupancy" value={`${data.metrics.occupancy}/${facility.capacity}`} detail={`${utilization}% utilized`} accent="cyan" />
          <Metric icon={<Ticket size={18} />} label="Admissions today" value={data.metrics.admissions} detail={`${data.metrics.available} spaces available`} accent="violet" />
          <Metric icon={<Activity size={18} />} label="Pool revenue" value={money(data.metrics.revenue, data.currency)} detail="From POS transactions" accent="emerald" />
          <Metric icon={<ShieldCheck size={18} />} label="Safety status" value={data.latestSafety?.status || 'PENDING'} detail={data.latestSafety ? `Checked ${new Date(data.latestSafety.checkedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Opening check required'} accent={data.latestSafety?.status === 'PASS' ? 'emerald' : 'amber'} />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-5">
          <div className="rounded-3xl border border-white/10 bg-white/[0.045] overflow-hidden"><div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/10 px-5 py-4"><div><h2 className="font-semibold">Guests currently inside</h2><p className="text-xs text-slate-500 mt-1">Live access register for {facility.name}</p></div><div className="relative"><Search size={15} className="absolute left-3 top-3 text-slate-500" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guest or wristband" className="w-full md:w-64 rounded-xl border border-white/10 bg-black/15 py-2.5 pl-9 pr-3 text-sm outline-none placeholder:text-slate-600 focus:border-cyan-300/40" /></div></div><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-[10px] uppercase tracking-widest text-slate-500"><tr><th className="px-5 py-3">Guest</th><th className="px-5 py-3">Pass</th><th className="px-5 py-3">Entry</th><th className="px-5 py-3">Status</th><th className="px-5 py-3"></th></tr></thead><tbody className="divide-y divide-white/[0.06]">{filteredEntries.length ? filteredEntries.map((entry: any) => <tr key={entry.id} className="hover:bg-white/[0.025]"><td className="px-5 py-4"><div className="flex items-center gap-3"><div className="h-9 w-9 rounded-xl bg-cyan-400/10 flex items-center justify-center text-xs font-bold text-cyan-200">{initials(entry.guest)}</div><div><div className="font-medium">{entry.guest ? `${entry.guest.firstName} ${entry.guest.lastName}` : 'Walk-in guest'}</div><div className="text-xs text-slate-500">{entry.identifier || entry.entryNumber}</div></div></div></td><td className="px-5 py-4 text-slate-300">{entry.passType?.name}</td><td className="px-5 py-4 text-slate-400">{entry.admittedAt ? new Date(entry.admittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</td><td className="px-5 py-4"><span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">Active</span></td><td className="px-5 py-4 text-right"><button onClick={() => transition(entry.id, 'checkout')} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:border-cyan-300/30 hover:text-cyan-200">Check out</button></td></tr>) : <tr><td colSpan={5} className="px-5 py-14 text-center text-sm text-slate-500">No active guests match this view.</td></tr>}</tbody></table></div></div>

          <aside className="space-y-5"><div className="rounded-3xl border border-white/10 bg-gradient-to-br from-cyan-400/10 to-blue-500/[0.03] p-5"><div className="flex items-center justify-between"><div><h2 className="font-semibold">Capacity monitor</h2><p className="mt-1 text-xs text-slate-500">{facility.name}</p></div><Droplets className="text-cyan-300" size={20} /></div><div className="mt-6 flex items-end justify-between"><span className="text-4xl font-semibold">{utilization}<span className="text-lg text-slate-500">%</span></span><span className="text-xs text-slate-400">{data.metrics.available} available</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${utilization >= 90 ? 'bg-rose-400' : utilization >= 70 ? 'bg-amber-300' : 'bg-cyan-300'}`} style={{ width: `${utilization}%` }} /></div><div className="mt-5 grid grid-cols-2 gap-2">{(facility.resources || []).slice(0, 4).map((resource: any) => <div key={resource.id} className="rounded-xl bg-white/[0.04] px-3 py-2"><div className="text-xs text-slate-400">{resource.name}</div><div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-emerald-300">{resource.status}</div></div>)}</div></div><div className="rounded-3xl border border-white/10 bg-white/[0.045] p-5"><div className="flex items-center justify-between"><h2 className="font-semibold">Operational alerts</h2><AlertTriangle className="text-amber-300" size={18} /></div>{data.incidents?.length ? <div className="mt-4 space-y-3">{data.incidents.slice(0, 4).map((incident: any) => <div key={incident.id} className="rounded-xl border border-amber-300/10 bg-amber-300/[0.05] p-3"><div className="text-sm font-medium">{incident.title}</div><div className="mt-1 text-xs text-slate-500">{incident.severity} · {incident.status}</div></div>)}</div> : <div className="mt-5 flex items-center gap-2 text-sm text-emerald-300"><CheckCircle2 size={16} /> No active incidents</div>}<button onClick={() => setShowSafety(true)} className="mt-5 w-full rounded-xl border border-white/10 py-2.5 text-xs font-bold text-slate-300 hover:bg-white/[0.04]"><ClipboardCheck size={14} className="inline mr-2" />Open safety checklist</button></div></aside>
        </section>
        <PoolOperationsPanels facilityId={facility.id} facilityName={facility.name} incidents={data.incidents || []} entries={data.activeEntries || []} passTypes={passTypes} onChanged={load} />
      </>}
    </div>

    {showAdmission && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={submitAdmission} className="w-full max-w-xl rounded-3xl border border-white/10 bg-[#101c2d] shadow-2xl"><div className="flex items-center justify-between border-b border-white/10 px-6 py-5"><div><h2 className="text-xl font-semibold">New pool admission</h2><p className="mt-1 text-xs text-slate-500">Create a controlled access record; payment remains in POS.</p></div><button type="button" onClick={() => setShowAdmission(false)} className="rounded-lg p-2 text-slate-400 hover:bg-white/10"><X size={18} /></button></div><div className="space-y-4 p-6"><label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Pass type<select required value={form.passTypeId} onChange={(e) => setForm({ ...form, passTypeId: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-slate-200 outline-none"><option value="">Choose pass</option>{passTypes.map((pass: any) => <option key={pass.id} value={pass.id}>{pass.name} · {money(Number(pass.price), pass.currency)}</option>)}</select></label><div><label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Hotel guest lookup</label><div className="relative mt-2"><Search size={15} className="absolute left-3 top-3.5 text-slate-500" /><input value={guestSearch} onChange={(e) => setGuestSearch(e.target.value)} placeholder="Name or phone" className="w-full rounded-xl border border-white/10 bg-black/15 py-3 pl-9 pr-3 text-sm outline-none placeholder:text-slate-600" /></div>{data?.guestMatches?.length ? <div className="mt-2 max-h-32 overflow-y-auto rounded-xl border border-white/10 bg-[#0b1626]">{data.guestMatches.map((guest: any) => <button type="button" key={guest.id} onClick={() => { setSelectedGuest(guest); setGuestSearch(`${guest.firstName} ${guest.lastName}`); setForm({ ...form, folioId: guest.reservations?.[0]?.folios?.[0]?.id || '' }); }} className={`block w-full px-3 py-2 text-left text-sm hover:bg-white/10 ${selectedGuest?.id === guest.id ? 'bg-cyan-400/10 text-cyan-200' : 'text-slate-300'}`}>{guest.firstName} {guest.lastName}<span className="ml-2 text-xs text-slate-500">{guest.phone || 'No phone'}</span></button>)}</div> : null}</div><div className="grid grid-cols-2 gap-3"><label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Guests<input type="number" min={1} max={20} value={form.guestCount} onChange={(e) => setForm({ ...form, guestCount: Number(e.target.value) })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-slate-200 outline-none" /></label><label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Wristband / ID<input value={form.identifier} onChange={(e) => setForm({ ...form, identifier: e.target.value })} placeholder="Optional" className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-slate-200 outline-none" /></label></div><label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">Payment method<select value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value })} className="mt-2 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm text-slate-200 outline-none"><option value="CASH">Cash</option><option value="CARD">Card</option><option value="POS">POS terminal</option><option value="BANK_TRANSFER">Bank transfer</option><option value="ROOM_CHARGE">Room charge</option><option value="COMPLIMENTARY">Complimentary</option></select></label><label className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-slate-300"><input type="checkbox" checked={form.waiverAccepted} onChange={(e) => setForm({ ...form, waiverAccepted: e.target.checked })} className="mt-0.5 accent-cyan-400" required /><span>Guest waiver and pool rules have been accepted.</span></label><button disabled={submitting || !selectedPass} className="w-full rounded-xl bg-cyan-400 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <Loader2 className="mx-auto animate-spin" size={18} /> : <><ArrowUpFromLine size={16} className="inline mr-2" />Admit guest now</>}</button></div></form></div>}
    {showSetup && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={submitSetup} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101c2d] p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Configure pool facility</h2><button type="button" onClick={() => setShowSetup(false)}><X size={18} /></button></div><p className="mt-2 text-sm text-slate-400">This creates the operational facility and standard pass types. Prices can be linked to POS products later.</p><div className="mt-5 space-y-4"><input required placeholder="Facility name" value={setupForm.name} onChange={(e) => setSetupForm({ ...setupForm, name: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm outline-none" /><div className="grid grid-cols-2 gap-3"><input required placeholder="Code" value={setupForm.code} onChange={(e) => setSetupForm({ ...setupForm, code: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm outline-none" /><input required type="number" min={1} placeholder="Capacity" value={setupForm.capacity} onChange={(e) => setSetupForm({ ...setupForm, capacity: Number(e.target.value) })} className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm outline-none" /></div><button disabled={submitting} className="w-full rounded-xl bg-cyan-400 py-3 font-bold text-slate-950">{submitting ? 'Saving…' : 'Create facility'}</button></div></form></div>}
    {showSafety && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><form onSubmit={submitSafety} className="w-full max-w-md rounded-3xl border border-white/10 bg-[#101c2d] p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Safety checklist</h2><button type="button" onClick={() => setShowSafety(false)}><X size={18} /></button></div><div className="mt-5 space-y-4"><select value={safetyForm.checkType} onChange={(e) => setSafetyForm({ ...safetyForm, checkType: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm"><option>OPENING</option><option>WATER_QUALITY</option><option>LIFEGUARD</option><option>CLOSING</option></select><select value={safetyForm.status} onChange={(e) => setSafetyForm({ ...safetyForm, status: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm"><option>PASS</option><option>ATTENTION</option><option>FAILED</option></select><div className="grid grid-cols-2 gap-3"><input type="number" step="0.001" placeholder="Chlorine" value={safetyForm.chlorine} onChange={(e) => setSafetyForm({ ...safetyForm, chlorine: e.target.value })} className="rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm" /><input type="number" step="0.001" placeholder="pH" value={safetyForm.ph} onChange={(e) => setSafetyForm({ ...safetyForm, ph: e.target.value })} className="rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm" /></div><textarea placeholder="Notes" value={safetyForm.notes} onChange={(e) => setSafetyForm({ ...safetyForm, notes: e.target.value })} className="min-h-20 w-full rounded-xl border border-white/10 bg-black/15 px-3 py-3 text-sm" /><button disabled={submitting} className="w-full rounded-xl bg-cyan-400 py-3 font-bold text-slate-950">{submitting ? 'Saving…' : 'Record safety check'}</button></div></form></div>}
    {showOperatorAuth && <TerminalAuthScreen authMode="POS_OPERATOR" isOpen cancellable={false} outletId={data?.poolOutletId || undefined} allowedRoles={['POOL_OPERATOR', 'POOL_MANAGER', 'CASHIER', 'POS_CASHIER']} onAuthenticated={() => { setShowOperatorAuth(false); setToast('Pool operator shift authenticated'); }} />}
  </main>;
}

function Metric({ icon, label, value, detail, accent }: { icon: React.ReactNode; label: string; value: React.ReactNode; detail: string; accent: string }) {
  const colors: Record<string, string> = { cyan: 'text-cyan-300 bg-cyan-400/10', violet: 'text-violet-300 bg-violet-400/10', emerald: 'text-emerald-300 bg-emerald-400/10', amber: 'text-amber-300 bg-amber-400/10' };
  return <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 md:p-5"><div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-500">{label}</span><span className={`rounded-xl p-2 ${colors[accent] || colors.cyan}`}>{icon}</span></div><div className="mt-4 text-xl md:text-2xl font-semibold tracking-tight">{value}</div><div className="mt-1 text-xs text-slate-500">{detail}</div></div>;
}
