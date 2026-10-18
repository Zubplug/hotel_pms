'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, CheckCircle2, Copy, ExternalLink, Link2, Share2, Sparkles, WalletCards } from 'lucide-react';
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
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/hr/self-service/referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Unable to activate staff referrals');
      setFeedback('Your personal referral link is ready to share.');
      await load();
    } catch (cause: any) {
      setError(cause.message || 'Unable to activate staff referrals');
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    if (!data?.campaign?.shareLink) return;
    await navigator.clipboard?.writeText(data.campaign.shareLink);
    setFeedback('Referral link copied to clipboard.');
  };

  if (error && !data) return <main className="ess-page mx-auto max-w-6xl p-4 text-sm text-rose-300 sm:p-8">{error}</main>;
  if (!data) return <main className="ess-page mx-auto max-w-6xl p-4 text-sm text-slate-400 sm:p-8">Loading staff referrals…</main>;

  const stats = data.stats || {};
  const commissions = data.recentCommissions || [];

  return <main className="ess-page mx-auto max-w-6xl space-y-4 p-3 pb-24 sm:space-y-6 sm:p-8 sm:pb-8">
    <header className="relative overflow-hidden rounded-[1.75rem] border border-purple-300/20 bg-[#151026] p-5 shadow-2xl shadow-purple-950/20 sm:rounded-3xl sm:p-7">
      <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-400/15 text-purple-200 ring-1 ring-purple-300/20 sm:h-12 sm:w-12"><Share2 className="h-5 w-5" /></div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-purple-300">Employee earnings</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">Staff referrals</h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">Share your personal booking link and earn commission when referred guests complete their stay.</p>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1.5 text-[10px] font-bold ${data.programmeEnabled ? 'border-emerald-300/20 bg-emerald-400/10 text-emerald-200' : 'border-white/10 bg-white/5 text-slate-400'}`}>{data.programmeEnabled ? 'Active' : 'Unavailable'}</span>
      </div>
    </header>

    {error && <p className="rounded-2xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-300">{error}</p>}
    {feedback && <p className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200"><CheckCircle2 className="h-4 w-4 shrink-0" />{feedback}</p>}

    {!data.programmeEnabled ? <section className="rounded-2xl border border-slate-800 bg-[#0b1421] p-5 text-sm leading-6 text-slate-400">Staff referrals are not active for this property yet. Your HR team will notify you when the programme becomes available.</section> : !data.isEnrolled ? <section className="rounded-2xl border border-purple-300/20 bg-gradient-to-br from-purple-500/10 to-[#0b1421] p-5"><div className="flex gap-3"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-400/15 text-purple-200"><Sparkles className="h-5 w-5" /></div><div><h2 className="font-bold text-white">Start earning from referrals</h2><p className="mt-1 text-sm leading-6 text-slate-400">Activate your account to create a personal booking link. Approved commissions are paid through payroll.</p></div></div><Button type="button" disabled={busy} onClick={() => void activate()} className="mt-5 h-11 w-full bg-purple-500 font-bold text-white hover:bg-purple-400 sm:w-auto">{busy ? 'Activating…' : 'Activate my referral link'}</Button></section> : <>
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <Metric label="Clicks" value={stats.totalClicks || 0} />
        <Metric label="Bookings" value={stats.totalBookings || 0} />
        <Metric label="Confirmed stays" value={stats.confirmedBookings || 0} />
        <Metric label="Total earned" value={naira(stats.totalEarned)} accent="text-emerald-300" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-purple-300/20 bg-[#0b1421] shadow-xl shadow-purple-950/10">
        <div className="border-b border-white/10 p-4 sm:p-5"><div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-purple-300" /><h2 className="font-bold text-white">Your referral link</h2></div><p className="mt-1 text-xs text-slate-500">Share this link with guests, friends, and family.</p></div>
        <div className="p-4 sm:p-5"><div className="rounded-xl border border-white/10 bg-slate-950/80 px-3 py-3 font-mono text-[11px] leading-5 text-purple-200 break-all">{data.campaign?.shareLink}</div><div className="mt-3 grid grid-cols-2 gap-2"><Button type="button" onClick={() => void copyLink()} className="h-11 gap-2 bg-purple-500 text-xs font-bold text-white hover:bg-purple-400"><Copy className="h-4 w-4" />Copy link</Button><Button type="button" variant="outline" onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Book through my LodgeCore referral link: ${data.campaign?.shareLink || ''}`)}`, '_blank', 'noopener,noreferrer')} className="h-11 gap-2 border-purple-300/30 bg-transparent text-xs font-bold text-purple-200 hover:bg-purple-400/10"><ExternalLink className="h-4 w-4" />WhatsApp</Button></div><div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-slate-500"><span>Rate <strong className="text-purple-200">{(Number(data.campaign?.commissionBps || 0) / 100).toFixed(2)}%</strong></span><span>Next payslip <strong className="text-amber-300">{naira(stats.pendingOnNextPayslip)}</strong></span><span>Paid <strong className="text-emerald-300">{naira(stats.paidViaPayroll)}</strong></span></div></div>
      </section>

      <section className="rounded-2xl border border-slate-800 bg-[#0b1421] p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><WalletCards className="h-4 w-4 text-teal-300" /><h2 className="font-bold text-white">Commission history</h2></div><span className="text-[10px] uppercase tracking-wider text-slate-500">Latest {Math.min(commissions.length, 30)}</span></div><div className="mt-3 divide-y divide-white/[0.06]">{commissions.map((commission: any) => <div key={commission.id} className="flex items-center gap-3 py-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300"><WalletCards className="h-4 w-4" /></div><div className="min-w-0 flex-1"><p className="text-xs font-semibold text-white">{commission.earnedAt ? new Date(commission.earnedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Commission'}</p><p className="mt-0.5 truncate text-[11px] text-slate-500">{commission.payslipPeriod || (commission.payslipId ? 'Queued in payroll' : 'Pending payroll')}</p></div><div className="text-right"><p className="text-sm font-bold text-emerald-300">{naira(commission.amount)}</p><p className={`mt-0.5 text-[10px] font-semibold ${commission.status === 'PAID' ? 'text-emerald-300' : commission.status === 'REVERSED' ? 'text-rose-300' : 'text-amber-300'}`}>{commission.status === 'PAID' ? 'Paid' : commission.payslipId ? 'Queued' : commission.status}</p></div></div>)}{!commissions.length && <div className="py-8 text-center"><WalletCards className="mx-auto h-7 w-7 text-slate-700" /><p className="mt-2 text-sm text-slate-500">No referral commissions yet.</p></div>}</div></section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><div className="flex items-start gap-3"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-400/10 text-teal-300"><ArrowUpRight className="h-4 w-4" /></div><div><h2 className="text-sm font-bold text-white">How it works</h2><p className="mt-1 text-xs leading-5 text-slate-500">A booking is tracked through your link, the guest completes their stay, and the approved commission is added to a future payslip.</p></div></div></section>
    </>}
  </main>;
}

function Metric({ label, value, accent = 'text-white' }: { label: string; value: string | number; accent?: string }) {
  return <div className="rounded-2xl border border-slate-800 bg-[#0b1421] p-3.5 sm:p-4"><p className="text-[10px] uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-1.5 truncate text-lg font-black sm:text-xl ${accent}`}>{value}</p></div>;
}
