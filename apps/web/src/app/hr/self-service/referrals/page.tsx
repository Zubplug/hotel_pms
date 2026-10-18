'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Copy, ExternalLink, Share2, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';

function naira(value: number) {
  return `₦${Number(value || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function EmployeeReferralsPage() {
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');

  const load = async () => {
    const response = await fetch('/api/hr/self-service/referral', { cache: 'no-store' });
    const json = await response.json();
    if (!response.ok) throw new Error(json.error || 'Unable to load staff referrals');
    setData(json);
  };

  useEffect(() => { void load().catch((cause) => setError(cause.message)); }, []);

  const activate = async () => {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/hr/self-service/referral', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to activate staff referrals');
      setFeedback('Your personal referral link is now active.');
      await load();
    } catch (cause: any) { setError(cause.message || 'Unable to activate staff referrals'); } finally { setBusy(false); }
  };

  const copyLink = async () => {
    if (!data?.campaign?.shareLink) return;
    await navigator.clipboard?.writeText(data.campaign.shareLink);
    setFeedback('Referral link copied.');
  };

  if (error && !data) return <main className="ess-page mx-auto max-w-6xl p-4 text-sm text-rose-300 sm:p-8">{error}</main>;
  if (!data) return <main className="ess-page mx-auto max-w-6xl p-4 text-sm text-slate-400 sm:p-8">Loading staff referrals…</main>;

  const stats = data.stats || {};
  return <main className="ess-page mx-auto max-w-6xl space-y-6 p-4 sm:p-8">
    <header className="flex flex-col justify-between gap-5 rounded-3xl border border-purple-400/20 bg-gradient-to-br from-purple-950/50 via-slate-950 to-slate-950 p-6 sm:flex-row sm:items-center">
      <div><div className="flex items-center gap-3"><Share2 className="h-6 w-6 text-purple-300" /><h1 className="text-2xl font-black text-white">Staff referrals</h1></div><p className="mt-2 max-w-2xl text-sm text-slate-400">Share your personal booking link and earn approved commission through payroll when referred guests complete their stay.</p></div>
      <span className={`rounded-full border px-3 py-2 text-xs font-bold ${data.programmeEnabled ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-400'}`}>{data.programmeEnabled ? 'Programme active' : 'Not active for this property'}</span>
    </header>

    {error && <p className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300">{error}</p>}
    {feedback && <p className="flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4" />{feedback}</p>}

    {!data.programmeEnabled ? <section className="rounded-2xl border border-slate-800 bg-[#090e17] p-6 text-sm text-slate-400">Staff referrals have not been enabled for this property. HR will notify you when the programme becomes available.</section> : !data.isEnrolled ? <section className="rounded-2xl border border-purple-400/20 bg-purple-400/[0.06] p-6"><h2 className="font-bold text-white">Activate your referral account</h2><p className="mt-2 max-w-2xl text-sm text-slate-400">Create your personal referral campaign. Approved commissions are included in a future payslip after the guest completes their stay.</p><Button type="button" disabled={busy} onClick={() => void activate()} className="mt-5 bg-purple-500 font-bold text-white hover:bg-purple-400">{busy ? 'Activating…' : 'Activate my referral link'}</Button></section> : <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Clicks', stats.totalClicks || 0], ['Bookings', stats.totalBookings || 0], ['Confirmed stays', stats.confirmedBookings || 0], ['Total earned', naira(stats.totalEarned)]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-slate-800 bg-[#090e17] p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-xl font-black text-white">{value}</p></div>)}</section>
      <section className="rounded-2xl border border-purple-400/20 bg-[#090e17] p-5"><div className="flex items-center gap-2"><Share2 className="h-4 w-4 text-purple-300" /><h2 className="font-bold text-white">Your personal referral link</h2></div><div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><p className="min-w-0 flex-1 truncate rounded-xl bg-slate-950 px-4 py-3 font-mono text-xs text-purple-200">{data.campaign?.shareLink}</p><div className="flex gap-2"><Button type="button" onClick={() => void copyLink()} className="gap-2 bg-purple-500 font-bold text-white hover:bg-purple-400"><Copy className="h-4 w-4" />Copy</Button><Button type="button" variant="outline" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Book through my LodgeCore referral link: ${data.campaign?.shareLink || ''}`)}`, '_blank', 'noopener,noreferrer')} className="gap-2 border-purple-300/30 bg-transparent text-purple-200 hover:bg-purple-400/10"><ExternalLink className="h-4 w-4" />WhatsApp</Button></div></div><p className="mt-3 text-xs text-slate-500">Commission rate: {(Number(data.campaign?.commissionBps || 0) / 100).toFixed(2)}% · Pending next payslip: <span className="font-semibold text-amber-300">{naira(stats.pendingOnNextPayslip)}</span> · Paid via payroll: <span className="font-semibold text-emerald-300">{naira(stats.paidViaPayroll)}</span></p></section>
      <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#090e17]"><div className="flex items-center gap-2 border-b border-slate-800 p-5"><WalletCards className="h-4 w-4 text-teal-300" /><h2 className="font-bold text-white">Commission history</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="bg-slate-950 text-[10px] uppercase tracking-wider text-slate-500"><tr><th className="p-4">Earned</th><th className="p-4">Amount</th><th className="p-4">Status</th><th className="p-4">Payroll period</th></tr></thead><tbody className="divide-y divide-slate-800">{(data.recentCommissions || []).map((commission: any) => <tr key={commission.id}><td className="p-4 text-slate-300">{commission.earnedAt ? new Date(commission.earnedAt).toLocaleDateString() : '—'}</td><td className="p-4 font-semibold text-white">{naira(commission.amount)}</td><td className={`p-4 font-semibold ${commission.status === 'PAID' ? 'text-emerald-300' : commission.status === 'REVERSED' ? 'text-rose-300' : 'text-amber-300'}`}>{commission.payslipId ? 'Queued in payroll' : commission.status}</td><td className="p-4 text-slate-400">{commission.payslipPeriod || '—'}</td></tr>)}</tbody></table>{!(data.recentCommissions || []).length && <p className="p-8 text-center text-sm text-slate-500">No referral commissions yet.</p>}</div></section>
    </>}
  </main>;
}
