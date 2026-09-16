import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireOrganizationContext } from '@/lib/organization-access';
import { ReceiveHandoverButton } from './receive-handover-button';
import { CreateHandoverButton } from './create-handover-button';
import { ArrowLeftRight, Banknote, CheckCircle2, Clock3, ShieldCheck, TrendingUp, Activity, WalletCards } from 'lucide-react';

const statusMeta: Record<string, { label: string; classes: string }> = {
  PENDING:   { label: 'Pending Receipt', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  COMPLETED: { label: 'Completed',       classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

export default async function HandoversPage() {
  const actor = await auth();
  if (!actor?.user) redirect('/login');

  const allowedProperties = (await requireOrganizationContext(actor.user.id)).propertyIds;
  const [handovers, approvedPos, approvedFrontdesk] = await Promise.all([
    prisma.cashHandover.findMany({
      where: { propertyId: { in: [...allowedProperties] } },
      orderBy: { handedOverAt: 'desc' },
      include: {
        handedOverBy: { select: { firstName: true, lastName: true } },
        receivedBy: { select: { firstName: true, lastName: true } },
        property: { select: { name: true } },
        posSessions: { select: { id: true, controlStatus: true, actualCash: true } },
        frontdeskSessions: { select: { id: true, status: true, declaredCash: true } },
      },
    }),
    prisma.posSession.findMany({
      where: {
        propertyId: { in: [...allowedProperties] },
        controlStatus: { in: ['APPROVED', 'APPROVED_WITH_VARIANCE'] },
        cashHandoverId: null,
      },
      select: { id: true, propertyId: true },
    }),
    prisma.frontdeskSession.findMany({
      where: {
        propertyId: { in: [...allowedProperties] },
        controlStatus: { in: ['APPROVED', 'APPROVED_WITH_VARIANCE'] },
        cashHandoverId: null,
      },
      select: { id: true, propertyId: true },
    }),
  ]);

  const canCreate =
    allowedProperties.length === 1 &&
    (approvedPos.length > 0 || approvedFrontdesk.length > 0);
  const pendingHandovers = handovers.filter((handover) => handover.status === 'PENDING');
  const completedHandovers = handovers.filter((handover) => handover.status === 'COMPLETED');
  const pendingAmount = pendingHandovers.reduce((sum, handover) => sum + Number(handover.amount || 0), 0);
  const completedAmount = completedHandovers.reduce((sum, handover) => sum + Number(handover.amount || 0), 0);
  const totalSessions = handovers.reduce((sum, handover) => sum + handover.posSessions.length + handover.frontdeskSessions.length, 0);
  const trendStart = new Date();
  trendStart.setDate(trendStart.getDate() - 6);
  const handoverTrend = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(trendStart);
    date.setDate(trendStart.getDate() + index);
    const key = date.toISOString().slice(0, 10);
    return { date, count: handovers.filter((handover) => new Date(handover.handedOverAt).toISOString().slice(0, 10) === key).length };
  });
  const trendMax = Math.max(...handoverTrend.map((day) => day.count), 1);

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-r from-[#0b1120] via-[#101d34] to-[#0b1120] px-6 py-8 sm:px-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="relative mx-auto flex max-w-[1440px] flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Cash custody operations</p>
            <h1 className="text-2xl font-bold tracking-tight text-white">Payment handovers</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Move approved shift collections into General Cashier custody with a traceable chain of responsibility.</p>
          </div>
          {canCreate && (
            <CreateHandoverButton
              propertyId={allowedProperties[0]}
              posSessionIds={approvedPos
                .filter((s) => s.propertyId === allowedProperties[0])
                .map((s) => s.id)}
              frontdeskSessionIds={approvedFrontdesk
                .filter((s) => s.propertyId === allowedProperties[0])
                .map((s) => s.id)}
            />
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] space-y-6 px-5 py-7 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Awaiting receipt', value: pendingHandovers.length, detail: `₦${pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} in custody queue`, icon: Clock3, tone: 'bg-amber-50 text-amber-700' },
            { label: 'Completed handovers', value: completedHandovers.length, detail: `₦${completedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} received`, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-700' },
            { label: 'Sessions transferred', value: totalSessions, detail: 'POS and Front Desk sessions', icon: WalletCards, tone: 'bg-indigo-50 text-indigo-700' },
            { label: 'Approved to transfer', value: approvedPos.length + approvedFrontdesk.length, detail: 'Ready for custody handover', icon: ShieldCheck, tone: 'bg-violet-50 text-violet-700' },
          ].map((card) => { const Icon = card.icon; return <div key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{card.label}</p><p className="mt-2 text-2xl font-black text-slate-950">{card.value}</p><p className="mt-1 text-xs text-slate-400">{card.detail}</p></div><span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.tone}`}><Icon className="h-5 w-5" /></span></div></div>; })}
        </div>
        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-start justify-between"><div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-indigo-600"><Activity className="h-4 w-4" />Custody flow</div><h2 className="mt-1 text-lg font-semibold text-slate-900">Seven-day handover activity</h2><p className="mt-1 text-sm text-slate-500">Volume of custody transfers created across your properties.</p></div><TrendingUp className="h-5 w-5 text-emerald-500" /></div><div className="mt-7 flex h-36 items-end gap-3">{handoverTrend.map((day) => <div key={day.date.toISOString()} className="group flex h-full flex-1 flex-col items-center justify-end gap-2"><div className="relative flex h-full w-full items-end justify-center"><span className="absolute bottom-full mb-1 hidden rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white group-hover:block">{day.count}</span><div className="w-full max-w-12 rounded-t-lg bg-indigo-100 transition group-hover:bg-indigo-400" style={{ height: `${Math.max((day.count / trendMax) * 100, day.count ? 12 : 4)}%` }} /></div><span className="text-[10px] font-semibold uppercase text-slate-400">{day.date.toLocaleDateString('en-GB', { weekday: 'short' }).slice(0, 3)}</span></div>)}</div></section>
          <section className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-indigo-300"><Banknote className="h-4 w-4" />Custody insight</div><h2 className="mt-2 text-lg font-semibold">What needs attention</h2><div className="mt-6 space-y-3"><div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-slate-400">Pending physical receipt</p><p className="mt-1 text-xl font-bold">{pendingHandovers.length} handover{pendingHandovers.length === 1 ? '' : 's'}</p><p className="mt-1 text-xs text-amber-300">₦{pendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} awaiting custody confirmation</p></div><div className="rounded-xl bg-white/10 p-4"><p className="text-xs text-slate-400">Control posture</p><p className="mt-1 text-sm font-semibold text-emerald-300">{pendingHandovers.length === 0 ? 'Clear — no custody backlog' : 'Monitor — receipt action required'}</p></div></div></section>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Table header bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-semibold text-slate-700">Custody transfer register</span>
              <span className="ml-1 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-slate-200 text-slate-600 text-xs font-bold">
                {handovers.length}
              </span>
            </div>
          </div>

          {handovers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
                <ArrowLeftRight className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-sm font-semibold text-slate-600">No handovers yet</p>
              <p className="text-sm text-slate-400 mt-1">
                Payment handovers will appear here once approved shifts are transferred to the general cashier.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100">
                    {[
                      'Reference',
                      'Property',
                      'Cash / Receipts',
                      'Status',
                      'Handed Over By',
                      'Received By',
                      'Sessions',
                      'Date',
                      '',
                    ].map((h, i) => (
                      <th
                        key={i}
                        className={`px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider whitespace-nowrap ${
                          i >= 2 ? 'text-right' : 'text-left'
                        } ${
                          i === 8 ? 'sticky right-0 bg-slate-50/90 backdrop-blur-sm border-l border-slate-100 z-10 shadow-[-4px_0_12px_rgba(0,0,0,0.02)]' : ''
                        }`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {handovers.map((h) => {
                    const meta =
                      statusMeta[h.status] ?? {
                        label: h.status,
                        classes: 'bg-slate-100 text-slate-700 border-slate-200',
                      };
                    const sessionCount =
                      h.posSessions.length + h.frontdeskSessions.length;
                    const paymentBreakdown = (h.paymentBreakdown || {}) as Record<string, { amount?: number; count?: number }>;
                    return (
                      <tr
                        key={h.id}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="px-6 py-4 font-mono text-xs font-semibold text-slate-800">
                          {h.handoverReference}
                        </td>
                        <td className="px-6 py-4 text-slate-600">{h.property.name}</td>
                        <td className="px-6 py-4 text-right font-semibold text-slate-800">
                          ₦{Number(h.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          <div className="mt-1 flex flex-wrap justify-end gap-1">
                            {Object.entries(paymentBreakdown).map(([method, value]) => (
                              <span key={method} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                {method.replace(/_/g, ' ')} ₦{Number(value.amount || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${meta.classes}`}
                          >
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600">
                          {h.handedOverBy.firstName} {h.handedOverBy.lastName}
                        </td>
                        <td className="px-6 py-4 text-right text-slate-600">
                          {h.receivedBy
                            ? `${h.receivedBy.firstName} ${h.receivedBy.lastName}`
                            : <span className="text-slate-400">—</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                            {sessionCount}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">
                          {new Date(h.handedOverAt).toLocaleString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="px-6 py-4 text-right sticky right-0 bg-white border-l border-slate-100 shadow-[-4px_0_12px_rgba(0,0,0,0.02)]">
                          <ReceiveHandoverButton
                            handoverId={h.id}
                            currentStatus={h.status}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
