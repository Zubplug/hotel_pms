'use client';

import { useEffect, useMemo, useState } from 'react';
import { BadgePercent, CheckCircle2, Settings2, Trophy, Users, WalletCards } from 'lucide-react';

type Tab = 'staff' | 'pending' | 'paid' | 'leaderboard';

export default function StaffReferralManagementPage() {
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState<Tab>('staff');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const response = await fetch('/api/hr/referral');
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Unable to load referral controls');
    setData(json);
  };

  useEffect(() => { load().catch((cause) => setError(cause.message)); }, []);

  const action = async (body: any) => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/hr/referral', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Action failed');
      await load();
    } catch (cause: any) { setError(cause.message); } finally { setBusy(false); }
  };

  const leaderboard = useMemo(() => [...(data?.staffReferrers || [])].sort((a, b) => b.earned - a.earned).slice(0, 10), [data]);
  if (error && !data) return <main className="p-8 text-sm text-rose-300">{error}</main>;
  if (!data) return <main className="p-8 text-sm text-slate-400">Loading staff referral controls…</main>;

  const tabs: Array<[Tab, string]> = [['staff', 'Staff referrers'], ['pending', 'Pending payroll'], ['paid', 'Paid history'], ['leaderboard', 'Leaderboard']];
  return <main className="mx-auto max-w-7xl space-y-6 p-4 text-slate-100 sm:p-8">
    <header className="flex flex-col justify-between gap-4 rounded-3xl border border-teal-400/20 bg-gradient-to-br from-teal-950/60 to-slate-950 p-6 sm:flex-row sm:items-center">
      <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-300">HR & payroll</p><h1 className="mt-2 text-2xl font-black text-white">Staff Referral Programme</h1><p className="mt-1 text-sm text-slate-400">Manage employee referral access and monitor commissions automatically paid through payroll.</p></div>
      <button disabled={busy} onClick={() => void action({ action: 'TOGGLE_PROGRAMME' })} className={`rounded-xl px-4 py-3 text-sm font-bold ${data.programme.staffReferralEnabled ? 'bg-emerald-500 text-slate-950' : 'bg-slate-700 text-white'}`}>{data.programme.staffReferralEnabled ? 'Programme active' : 'Enable programme'}</button>
    </header>
    {error && <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300">{error}</p>}
    <section className="grid gap-3 sm:grid-cols-4"><Metric icon={Users} label="Active referrers" value={data.summary.activeReferrers} /><Metric icon={WalletCards} label="Pending next payroll" value={`₦${Number(data.summary.pendingNextPayroll.amount).toLocaleString()}`} /><Metric icon={CheckCircle2} label="Paid this month" value={`₦${Number(data.summary.paidThisMonth.amount).toLocaleString()}`} /><Metric icon={BadgePercent} label="Commission rate" value={`${(Number(data.programme.commissionBps || 0) / 100).toFixed(2)}%`} /></section>
    <nav className="flex flex-wrap gap-2 rounded-2xl border border-slate-800 bg-[#0b1624] p-2">{tabs.map(([value, label]) => <button key={value} onClick={() => setTab(value)} className={`rounded-xl px-3 py-2 text-xs font-bold ${tab === value ? 'bg-teal-400 text-slate-950' : 'text-slate-400 hover:bg-white/5'}`}>{label}</button>)}</nav>

    {tab === 'staff' && <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1624]"><div className="border-b border-slate-800 p-5"><h2 className="font-bold text-white">Staff referrers</h2><p className="mt-1 text-xs text-slate-500">Campaigns are property-scoped and commissions are included automatically in payroll.</p></div><div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-xs"><thead className="bg-slate-950 text-[10px] uppercase text-slate-500"><tr><th className="p-4">Staff</th><th className="p-4">Referral code</th><th className="p-4">Clicks</th><th className="p-4">Bookings</th><th className="p-4">Pending</th><th className="p-4">Earned</th><th className="p-4">Action</th></tr></thead><tbody className="divide-y divide-slate-800">{data.staffReferrers.map((row: any) => <tr key={row.id}><td className="p-4"><strong className="text-white">{row.name}</strong><small className="mt-1 block text-slate-500">{row.employeeId || 'Employee'}</small></td><td className="p-4 font-mono text-teal-300">{row.code}</td><td className="p-4">{row.clicks}</td><td className="p-4">{row.bookings}</td><td className="p-4 text-amber-300">₦{Number(row.pending).toLocaleString()}</td><td className="p-4 text-emerald-300">₦{Number(row.earned).toLocaleString()}</td><td className="p-4"><button disabled={busy} onClick={() => void action({ action: 'TOGGLE_STAFF_CAMPAIGN', campaignId: row.campaignId, isActive: !row.isActive })} className="rounded-lg border border-slate-700 px-3 py-2 text-[11px] font-semibold text-slate-300">{row.isActive ? 'Pause' : 'Activate'}</button></td></tr>)}</tbody></table>{!data.staffReferrers.length && <p className="p-8 text-center text-sm text-slate-500">No staff members have activated referrals yet.</p>}</div></section>}

    {tab === 'pending' && <CommissionList title="Pending payroll commissions" commissions={data.pendingCommissions} pending busy={busy} onVoid={(id) => { const reason = window.prompt('Reason for voiding this commission:'); if (reason?.trim()) void action({ action: 'VOID_COMMISSION', commissionId: id, reason }); }} />}
    {tab === 'paid' && <CommissionList title="Paid history" commissions={data.recentlyPaid} />}
    {tab === 'leaderboard' && <section className="rounded-2xl border border-slate-800 bg-[#0b1624] p-5"><h2 className="font-bold text-white">Top staff referrers</h2><div className="mt-4 divide-y divide-slate-800">{leaderboard.map((row: any, index) => <div key={row.id} className="flex items-center gap-4 py-4"><Trophy className={`h-5 w-5 ${index === 0 ? 'text-amber-300' : 'text-slate-500'}`} /><span className="w-6 text-sm font-bold text-slate-500">#{index + 1}</span><div className="min-w-0 flex-1"><p className="font-semibold text-white">{row.name}</p><p className="text-xs text-slate-500">{row.clicks} clicks · {row.bookings} bookings</p></div><strong className="text-emerald-300">₦{Number(row.earned).toLocaleString()}</strong></div>)}{!leaderboard.length && <p className="py-8 text-center text-sm text-slate-500">No referral earnings yet.</p>}</div></section>}

    <section className="rounded-2xl border border-slate-800 bg-[#0b1624] p-5"><div className="flex items-center gap-2"><Settings2 className="h-4 w-4 text-teal-300" /><h2 className="font-bold text-white">Programme settings</h2></div><div className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><p className="text-xs text-slate-500">Commission rate</p><p className="mt-1 font-bold text-white">{(Number(data.programme.commissionBps || 0) / 100).toFixed(2)}% of eligible room revenue</p></div><div><p className="text-xs text-slate-500">Attribution window</p><p className="mt-1 font-bold text-white">{data.programme.attributionWindowDays} days</p></div><div><p className="text-xs text-slate-500">Currency</p><p className="mt-1 font-bold text-white">{data.programme.currency}</p></div></div><p className="mt-4 text-xs text-slate-500">Rates are controlled by the property Reach programme configuration. Existing approved commissions remain eligible when staff referrals are paused.</p></section>
  </main>;
}

function CommissionList({ title, commissions, pending, busy, onVoid }: { title: string; commissions: any[]; pending?: boolean; busy?: boolean; onVoid?: (id: string) => void }) {
  return <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1624]"><div className="border-b border-slate-800 p-5"><h2 className="font-bold text-white">{title}</h2></div><div className="divide-y divide-slate-800">{commissions.map((commission: any) => <div key={commission.id} className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"><div><p className="text-sm font-semibold text-white">{commission.staffName}</p><p className="text-xs text-slate-500">{commission.earnedAt ? new Date(commission.earnedAt).toLocaleDateString() : commission.paidAt ? new Date(commission.paidAt).toLocaleDateString() : '—'}{commission.payslipPeriod ? ` · ${commission.payslipPeriod}` : ''}{commission.bookingStatus ? ` · Booking ${commission.bookingStatus}` : ''}</p></div><div className="flex items-center gap-3"><strong className="text-emerald-300">₦{Number(commission.amount).toLocaleString()}</strong>{pending && onVoid && <button disabled={busy} onClick={() => onVoid(commission.id)} className="rounded-lg border border-rose-400/20 px-3 py-2 text-[11px] font-semibold text-rose-300">Void</button>}</div></div>)}{!commissions.length && <p className="p-8 text-center text-sm text-slate-500">No commissions in this view.</p>}</div></section>;
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: any }) { return <div className="rounded-2xl border border-slate-800 bg-[#0b1624] p-4"><Icon className="h-5 w-5 text-teal-300" /><p className="mt-3 text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p></div>; }
