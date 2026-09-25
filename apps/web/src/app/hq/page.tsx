import prisma from '@hotel-pms/db';
import { ArrowUpRight, BellRing, Building2, CheckCircle2, CircleAlert, CreditCard, Gauge, Users } from 'lucide-react';
import { requireHQAdmin } from '@/lib/auth/hq';
import { HQPortfolioCharts } from './HQDashboardCharts';

const money = (amount: number, currency = 'USD') => new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount / 100);
const monthLabel = (date: Date) => date.toLocaleDateString('en-US', { month: 'short' });

export default async function HQDashboard() {
  await requireHQAdmin();
  const since = new Date();
  since.setMonth(since.getMonth() - 5, 1);
  since.setHours(0, 0, 0, 0);

  const [organizations, properties, activeProperties, users, activeStaff, subscriptions, items, invoices, connections, failedOutbox, recentLogs, recentOrganizations] = await Promise.all([
    prisma.organization.count(),
    prisma.property.count(),
    prisma.property.count({ where: { isActive: true } }),
    prisma.user.count(),
    prisma.staff.count({ where: { isActive: true, deletedAt: null } }),
    prisma.subscription.findMany({ select: { status: true } }),
    prisma.subscriptionItem.findMany({ where: { subscription: { status: { in: ['ACTIVE', 'TRIALING'] } } }, include: { price: true } }),
    prisma.billingInvoice.aggregate({ _sum: { amountDue: true }, where: { status: { in: ['open', 'OPEN', 'past_due', 'PENDING'] } } }),
    prisma.channelConnection.findMany({ select: { status: true } }),
    prisma.outboxEvent.count({ where: { status: { in: ['FAILED', 'DEAD_LETTER'] } } }),
    prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 6, include: { organization: { select: { name: true } } } }),
    prisma.organization.findMany({ orderBy: { createdAt: 'desc' }, take: 5, include: { properties: { select: { id: true, isActive: true } }, subscriptions: { select: { status: true }, orderBy: { createdAt: 'desc' }, take: 1 } } }),
  ]);

  const mrrCents = items.reduce((sum, item) => sum + (item.price.interval === 'year' ? Math.round(item.price.amount / 12) : item.price.amount), 0);
  const activeSubscriptions = subscriptions.filter((item) => item.status === 'ACTIVE').length;
  const attentionSubscriptions = subscriptions.filter((item) => ['PAST_DUE', 'INCOMPLETE', 'CANCELED'].includes(item.status)).length;
  const connectionStatuses = Object.entries(connections.reduce<Record<string, number>>((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {})).map(([status, count]) => ({ status, count }));
  const subscriptionStatuses = Object.entries(subscriptions.reduce<Record<string, number>>((acc, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {})).map(([status, count]) => ({ status, count }));
  const monthly = Array.from({ length: 6 }, (_, index) => { const date = new Date(since); date.setMonth(since.getMonth() + index); return { date, label: monthLabel(date), organizations: 0, properties: 0 }; });
  const created = await prisma.organization.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, properties: { select: { createdAt: true } } } });
  for (const org of created) { const point = monthly.find((item) => item.date.getFullYear() === org.createdAt.getFullYear() && item.date.getMonth() === org.createdAt.getMonth()); if (point) { point.organizations += 1; point.properties += org.properties.filter((property) => property.createdAt >= since).length; } }
  const chartMonthly = monthly.map(({ label, organizations: orgs, properties: props }) => ({ label, organizations: orgs, properties: props }));
  const healthScore = organizations === 0 ? 100 : Math.round((activeProperties / Math.max(properties, 1)) * 100);

  return <div className="min-h-full bg-[#07111f] p-5 text-slate-200 sm:p-8 xl:p-10">
    <div className="mx-auto max-w-[1500px] space-y-8">
      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div><div className="mb-3 flex items-center gap-2 text-xs font-medium text-indigo-300"><span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_14px_#34d399]" />Platform operations · live portfolio</div><h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Good morning, command centre.</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">One operating view for every organisation, property, subscription, and integration in LodgeCore.</p></div>
        <div className="flex gap-2"><a href="/hq/organizations" className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[.04] px-3 text-sm font-medium text-slate-200 hover:bg-white/[.08]">Manage portfolio <ArrowUpRight className="size-4" /></a><a href="/hq/activity" className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-500 px-3 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-400">Review activity <BellRing className="size-4" /></a></div>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[{ label: 'Organisations', value: organizations, note: `${activeProperties} active properties`, icon: Building2, tone: 'indigo' }, { label: 'Estimated MRR', value: money(mrrCents), note: `${activeSubscriptions} active subscriptions`, icon: CreditCard, tone: 'emerald' }, { label: 'Platform access', value: users, note: `${activeStaff} active staff accounts`, icon: Users, tone: 'sky' }, { label: 'Portfolio health', value: `${healthScore}%`, note: failedOutbox ? `${failedOutbox} failed sync events` : 'No failed outbox events', icon: Gauge, tone: failedOutbox ? 'amber' : 'emerald' }].map((item) => <div key={item.label} className="rounded-2xl border border-white/10 bg-[#101b2f] p-5 shadow-2xl shadow-slate-950/10"><div className="flex items-start justify-between"><div><p className="text-xs font-medium uppercase tracking-[.15em] text-slate-500">{item.label}</p><p className="mt-3 text-3xl font-semibold tracking-tight text-white">{item.value}</p></div><div className={`rounded-xl p-2.5 ${item.tone === 'emerald' ? 'bg-emerald-400/10 text-emerald-300' : item.tone === 'amber' ? 'bg-amber-400/10 text-amber-300' : item.tone === 'sky' ? 'bg-sky-400/10 text-sky-300' : 'bg-indigo-400/10 text-indigo-300'}`}><item.icon className="size-5" /></div></div><p className="mt-3 text-xs text-slate-400">{item.note}</p></div>)}
      </section>

      <HQPortfolioCharts monthly={chartMonthly} subscriptions={subscriptionStatuses} connections={connectionStatuses} />

      <section className="grid gap-5 xl:grid-cols-[1.1fr_1.4fr]">
        <div className="rounded-2xl border border-white/10 bg-[#101b2f] p-5"><div className="mb-5 flex items-start justify-between"><div><p className="text-sm font-semibold text-white">Attention queue</p><p className="mt-1 text-xs text-slate-400">Signals that may need HQ intervention</p></div><CircleAlert className="size-5 text-amber-300" /></div><div className="space-y-3">{attentionSubscriptions > 0 && <a href="/hq/invoices" className="flex items-center justify-between rounded-xl border border-amber-300/15 bg-amber-300/[.06] p-3 hover:bg-amber-300/[.1]"><div><p className="text-sm font-medium text-amber-100">Billing exceptions</p><p className="mt-1 text-xs text-amber-200/60">{attentionSubscriptions} subscription records need review</p></div><ArrowUpRight className="size-4 text-amber-300" /></a>}{failedOutbox > 0 && <a href="/hq/activity" className="flex items-center justify-between rounded-xl border border-rose-300/15 bg-rose-300/[.06] p-3 hover:bg-rose-300/[.1]"><div><p className="text-sm font-medium text-rose-100">Delivery failures</p><p className="mt-1 text-xs text-rose-200/60">{failedOutbox} outbox events are failed or dead-lettered</p></div><ArrowUpRight className="size-4 text-rose-300" /></a>}{attentionSubscriptions === 0 && failedOutbox === 0 && <div className="flex items-center gap-3 rounded-xl border border-emerald-300/15 bg-emerald-300/[.06] p-4"><CheckCircle2 className="size-5 text-emerald-300" /><div><p className="text-sm font-medium text-emerald-100">Portfolio is clear</p><p className="mt-1 text-xs text-emerald-200/60">No billing or delivery exceptions are currently recorded.</p></div></div>}<div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[.025] p-3"><div><p className="text-sm font-medium text-slate-200">Outstanding invoice balance</p><p className="mt-1 text-xs text-slate-500">Open, pending, and past-due records</p></div><span className="text-sm font-semibold text-white">{money(invoices._sum.amountDue ?? 0)}</span></div></div></div>
        <div className="rounded-2xl border border-white/10 bg-[#101b2f] p-5"><div className="mb-5 flex items-start justify-between"><div><p className="text-sm font-semibold text-white">Portfolio pulse</p><p className="mt-1 text-xs text-slate-400">Most recently created organisations</p></div><a href="/hq/organizations" className="text-xs font-medium text-indigo-300 hover:text-indigo-200">View all →</a></div><div className="overflow-x-auto"><table className="w-full min-w-[540px] text-left text-sm"><thead className="text-[10px] uppercase tracking-[.14em] text-slate-500"><tr><th className="pb-3 font-medium">Organisation</th><th className="pb-3 font-medium">Properties</th><th className="pb-3 font-medium">Plan</th><th className="pb-3 text-right font-medium">Status</th></tr></thead><tbody className="divide-y divide-white/6">{recentOrganizations.map((org) => { const status = org.subscriptions[0]?.status || 'NO PLAN'; return <tr key={org.id}><td className="py-3"><p className="font-medium text-slate-200">{org.name}</p><p className="mt-0.5 text-xs text-slate-500">{org.slug}</p></td><td className="py-3 text-slate-400">{org.properties.length}</td><td className="py-3 text-xs text-slate-400">{status === 'NO PLAN' ? 'Unconfigured' : status}</td><td className="py-3 text-right"><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium ${status === 'ACTIVE' || status === 'TRIALING' ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-400/10 text-slate-400'}`}><span className="size-1.5 rounded-full bg-current" />{status === 'ACTIVE' || status === 'TRIALING' ? 'Healthy' : 'Review'}</span></td></tr>})}</tbody></table>{recentOrganizations.length === 0 && <p className="py-8 text-center text-sm text-slate-500">No organisations have been created yet.</p>}</div></div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#101b2f] p-5"><div className="mb-5 flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Recent platform activity</p><p className="mt-1 text-xs text-slate-400">Cross-tenant audit events from the system of record</p></div><a href="/hq/activity" className="text-xs font-medium text-indigo-300 hover:text-indigo-200">Open audit log →</a></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{recentLogs.map((log) => <div key={log.id} className="rounded-xl border border-white/8 bg-white/[.025] p-4"><div className="flex items-center justify-between gap-3"><span className="truncate text-xs font-semibold text-indigo-200">{log.action}</span><span className="shrink-0 text-[11px] text-slate-500">{log.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div><p className="mt-2 truncate text-sm text-slate-300">{log.organization.name}</p><p className="mt-1 truncate text-xs text-slate-500">{log.resource} · {log.userEmail || 'System'}</p></div>)}{recentLogs.length === 0 && <p className="text-sm text-slate-500">No audit activity has been recorded yet.</p>}</div></section>
    </div>
  </div>;
}
