import Link from 'next/link';
import { prisma } from '@hotel-pms/db';
import { requireEventContext } from '@/lib/events/access';
import { NewLeaseDialog } from '@/components/events/NewLeaseDialog';
import { LeasePendingSubmissions } from '@/components/events/LeasePendingSubmissions';
import { ArrowUpRight, CalendarDays, Landmark, Repeat2, Sparkles } from 'lucide-react';

const money = (value: number, currency: string) => `${currency === 'NGN' ? '₦' : currency} ${Math.round(value).toLocaleString('en-NG')}`;
const dateLabel = (value: Date) => value.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });

export default async function HallUseContractsPage() {
  const { propertyId } = await requireEventContext();
  const now = new Date();
  const recentCutoff = new Date(now.getTime() - 90 * 86400000);
  const [property, halls, corporates, contracts] = await Promise.all([
    prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true } }),
    prisma.hall.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true, capacity: true } }),
    prisma.corporateAccount.findMany({ where: { propertyId, isActive: true, cityLedgerAccount: { is: { status: 'ACTIVE' } } }, orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } }),
    prisma.leaseContract.findMany({ where: { propertyId, OR: [{ isActive: true }, { endDate: { gte: recentCutoff } }] }, include: { hall: true, segments: { include: { hall: true } }, corporateAccount: true, schedules: { select: { id: true, status: true, amount: true, usageCount: true, dueDate: true, periodStart: true, periodEnd: true } } }, orderBy: [{ isActive: 'desc' }, { endDate: 'asc' }] }),
  ]);
  const active = contracts.filter((contract) => contract.isActive);
  const recent = contracts.filter((contract) => !contract.isActive);
  const currency = property?.baseCurrency || 'NGN';
  const pendingSchedules = active.flatMap((contract) => contract.schedules.filter((schedule) => schedule.status === 'PENDING').map((schedule) => ({ ...schedule, corporateName: contract.corporateAccount?.name || contract.contactName })));
  const scheduledValue = active.reduce((total, contract) => total + contract.schedules.filter((schedule) => schedule.status !== 'VOID').reduce((sum, schedule) => sum + Number(schedule.amount), 0), 0);

  return <div className="fnb-dark-surface min-h-full bg-[#07111f] text-slate-100">
    <header className="border-b border-white/10 bg-[#101a2d]"><div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-6 lg:px-8"><div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end"><div><div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-cyan-300"><Sparkles className="h-4 w-4" /> F&B commercial operations</div><h1 className="text-3xl font-bold sm:text-4xl">Hall leases</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Manage recurring hall contracts and submit billing periods for Accountant review.</p></div><div className="flex flex-wrap gap-2"><Link href="/fnb/events" className="inline-flex h-9 items-center rounded-md border border-white/10 bg-white/5 px-3 text-xs font-bold">Events command centre <ArrowUpRight className="ml-2 h-4 w-4" /></Link><NewLeaseDialog propertyId={propertyId} halls={halls} corporates={corporates} currency={currency} /></div></div></div></header>
    <main className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="grid gap-4 sm:grid-cols-3"><Metric label="Active contracts" value={String(active.length)} detail="Recurring hall reservations" /><Metric label="Scheduled value" value={money(scheduledValue, currency)} detail="Non-void billing periods" /><Metric label="Pending submission" value={String(pendingSchedules.length)} detail="Ready for Accountant review" /></section>
      <LeasePendingSubmissions schedules={pendingSchedules} />
      <section className="rounded-2xl border border-cyan-300/20 bg-cyan-400/[.06] p-5"><div className="flex items-start gap-3"><div className="rounded-xl bg-cyan-400/10 p-2.5 text-cyan-300"><Landmark className="h-5 w-5" /></div><div><h2 className="font-bold text-cyan-100">Multi-hall contract controls</h2><p className="mt-1 text-xs leading-5 text-slate-400">Each segment has its own hall, days, time, rate, conflict validation, and invoice line. Submit a pending period above when it is ready for accounting.</p></div></div></section>
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#101a2d]"><div className="border-b border-white/10 px-5 py-5"><h2 className="font-bold text-white">Active contracts</h2><p className="mt-1 text-xs text-slate-400">One contract can cover Sunday Hall B, Tuesday Gym Hall, and Friday Meeting Hall.</p></div>{active.length ? <div className="divide-y divide-white/10">{active.map((contract) => <div key={contract.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex min-w-0 items-start gap-3"><div className="rounded-xl bg-cyan-400/10 p-2.5 text-cyan-300"><Repeat2 className="h-5 w-5" /></div><div className="min-w-0"><p className="font-bold text-white">{contract.corporateAccount?.name || contract.contactName}</p><p className="mt-1 text-sm text-slate-300">{contract.segments.length ? contract.segments.map((segment) => `${segment.hall.name} · ${segment.startTime}–${segment.endTime}`).join(' • ') : contract.hall.name}</p><p className="mt-1 text-xs text-slate-500">{dateLabel(contract.startDate)} → {dateLabel(contract.endDate)} · {contract.billingFrequency.toLowerCase()} billing</p></div></div><div className="flex items-center gap-4 text-xs"><span className="text-slate-400">{contract.schedules.length} periods</span><span className="font-bold text-amber-300">{contract.schedules.filter((schedule) => schedule.status === 'PENDING').length} pending</span></div></div>)}</div> : <div className="p-14 text-center"><CalendarDays className="mx-auto h-8 w-8 text-slate-600" /><p className="mt-3 font-semibold text-white">No active hall leases</p><p className="mt-1 text-xs text-slate-500">Create a recurring contract to reserve and bill hall usage.</p></div>}</section>
      {recent.length > 0 && <section className="rounded-2xl border border-white/10 bg-[#101a2d] p-5"><h2 className="font-bold text-white">Recent closed contracts</h2><div className="mt-3 space-y-2">{recent.map((contract) => <p key={contract.id} className="text-xs text-slate-400">{contract.corporateAccount?.name || contract.contactName} · {contract.hall.name} · ended {dateLabel(contract.endDate)}</p>)}</div></section>}
    </main>
  </div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) { return <div className="rounded-2xl border border-white/10 bg-[#101a2d] p-5"><p className="text-[10px] font-bold uppercase tracking-[.14em] text-slate-400">{label}</p><p className="mt-3 text-2xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-slate-400">{detail}</p></div>; }
