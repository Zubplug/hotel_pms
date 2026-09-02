import React from 'react';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { formatCurrency } from '@/lib/utils';
import {
  Wallet,
  Receipt,
  ArrowDownToLine,
  ArrowUpFromLine,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  ArrowRight,
  CalendarDays,
  TrendingUp,
  Landmark,
  ShieldCheck,
  Users,
  Banknote,
} from 'lucide-react';

export default async function GeneralCashierDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const propertyId = (session.user as any).propertyId;
  if (!propertyId) redirect('/hub');

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { baseCurrency: true, businessDate: true },
  });
  if (!property) redirect('/hub');
  const businessDate = property.businessDate ?? new Date();

  const activeOutletShifts = await prisma.posSession.findMany({
    where: { propertyId, status: 'OPEN' },
    include: { outlet: true, primaryOperator: true },
  });

  const [
    safeAccount,
    revenue,
    frontDeskRevenue,
    pettyCash,
    pendingApprovals,
    pendingReviewPosShifts,
    activeFrontDeskShifts,
    pendingReviewFrontDeskShifts,
    pendingHandovers,
    pendingDeposits,
    receivablesExposure,
    posPaymentMix,
    frontDeskPaymentMix,
  ] = await Promise.all([
    prisma.cashAccount.findFirst({
      where: { propertyId, type: 'SAFE', isActive: true },
      select: { balance: true },
    }),
    prisma.posPayment.aggregate({
      where: {
        order: { propertyId },
        businessDate,
        status: 'CONFIRMED',
        amount: { gt: 0 },
      },
      _sum: { amount: true },
    }),
    prisma.payment.aggregate({
      where: {
        propertyId,
        createdAt: {
          gte: businessDate,
          lt: new Date(businessDate.getTime() + 86_400_000),
        },
        status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
      },
      _sum: { amount: true },
    }),
    prisma.posCashMovement.aggregate({
      where: { propertyId, businessDate, type: 'PAID_OUT' },
      _sum: { amount: true },
    }),
    prisma.approvalRequest.count({
      where: { propertyId, status: 'PENDING' },
    }),
    prisma.posSession.findMany({
      where: {
        propertyId,
        controlStatus: { in: ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED'] },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        outlet: true,
        primaryOperator: true,
        settlements: { orderBy: { settledAt: 'desc' }, take: 1 },
        payments: true,
        cashMovements: true,
        orders: { select: { status: true } },
      },
    }),
    prisma.frontdeskSession.findMany({
      where: {
        propertyId,
        status: { in: ['OPEN', 'CLOSING'] },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
      include: {
        staff: true,
        cashAccount: true,
        payments: true,
        cashMovements: true,
        exceptions: true,
      },
    }),
    prisma.frontdeskSession.findMany({
      where: {
        propertyId,
        controlStatus: { in: ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED'] },
      },
      orderBy: { updatedAt: 'desc' },
      include: {
        staff: true,
        cashAccount: true,
        payments: true,
        cashMovements: true,
        exceptions: true,
      },
    }),
    prisma.cashHandover.aggregate({
      where: { propertyId, status: 'PENDING' },
      _count: { _all: true },
      _sum: { amount: true },
    }),
    prisma.bankDeposit.findMany({
      where: {
        propertyId,
        status: { in: ['PENDING_HANDOVER', 'HANDED_OVER', 'UNDER_RECONCILIATION', 'EXCEPTION'] },
      },
      select: { expectedAmount: true, status: true },
    }),
    prisma.folio.aggregate({
      where: { propertyId, status: 'OPEN', balance: { gt: 0 } },
      _count: { _all: true },
      _sum: { balance: true },
    }),
    prisma.posPayment.findMany({
      where: {
        order: { propertyId },
        businessDate,
        status: 'CONFIRMED',
        amount: { gt: 0 },
      },
      select: { method: true, amount: true },
    }),
    prisma.payment.findMany({
      where: {
        propertyId,
        createdAt: { gte: businessDate, lt: new Date(businessDate.getTime() + 86_400_000) },
        status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
        amount: { gt: 0 },
      },
      select: { method: true, amount: true },
    }),
  ]);

  const currency = property.baseCurrency;
  const todayRevenue =
    Number(revenue._sum?.amount || 0) + Number(frontDeskRevenue._sum?.amount || 0);
  const cashInDrawer = Number(safeAccount?.balance || 0);
  const pettyCashPayouts = Number(pettyCash._sum?.amount || 0);
  const pendingDrops = activeOutletShifts.length + activeFrontDeskShifts.length;
  const pendingHandoverCount = pendingHandovers._count._all;
  const pendingHandoverAmount = Number(pendingHandovers._sum.amount || 0);
  const depositExceptionCount = pendingDeposits.filter((deposit) => deposit.status === 'EXCEPTION').length;
  const depositPipelineAmount = pendingDeposits.reduce((sum, deposit) => sum + Number(deposit.expectedAmount), 0);
  const receivablesCount = receivablesExposure._count._all;
  const receivablesAmount = Number(receivablesExposure._sum.balance || 0);
  const paymentMix = [...posPaymentMix, ...frontDeskPaymentMix].reduce<Record<string, number>>((mix, payment) => {
    mix[payment.method] = (mix[payment.method] || 0) + Number(payment.amount);
    return mix;
  }, {});
  const paymentMixRows = Object.entries(paymentMix).sort(([, amountA], [, amountB]) => amountB - amountA);
  const paymentMixTotal = paymentMixRows.reduce((sum, [, amount]) => sum + amount, 0);
  // `primaryOperator` is not populated for every legacy/offline POS shift.
  // Those sessions still retain the staff identity in `openedBy`, so resolve
  // it before displaying the queue instead of incorrectly showing "System".
  const posOpenedByIds = Array.from(
    new Set(
      pendingReviewPosShifts
        .map((shift) => shift.openedBy)
        .filter((id): id is string => Boolean(id))
    )
  );
  const openedByStaff = posOpenedByIds.length
    ? await prisma.staff.findMany({
        where: { OR: [{ id: { in: posOpenedByIds } }, { userId: { in: posOpenedByIds } }] },
        select: { id: true, userId: true, firstName: true, lastName: true },
      })
    : [];
  const openedByStaffMap = new Map();
  openedByStaff.forEach((staff) => {
    openedByStaffMap.set(staff.id, staff);
    if (staff.userId) openedByStaffMap.set(staff.userId, staff);
  });

  const queueItems = [
    ...pendingReviewPosShifts.map((shift) => ({
      id: shift.id,
      type: 'POS' as const,
      label: shift.outlet.name,
      operator: (() => {
        const operator = shift.primaryOperator || openedByStaffMap.get(shift.openedBy);
        return operator
          ? `${operator.firstName} ${operator.lastName}`.trim()
          : 'Unassigned operator';
      })(),
      status: shift.controlStatus || 'SUBMITTED',
      expected: Number(shift.openingCash || 0) + Number(shift.cashSales || 0) + Number(shift.cashIn || 0) - Number(shift.cashRefunds || 0) - Number(shift.cashOut || 0),
      declared: shift.actualCash == null ? null : Number(shift.actualCash),
      variance: shift.actualCash == null ? null : Number(shift.actualCash) - (Number(shift.openingCash || 0) + Number(shift.cashSales || 0) + Number(shift.cashIn || 0) - Number(shift.cashRefunds || 0) - Number(shift.cashOut || 0)),
      updatedAt: shift.updatedAt,
    })),
    ...pendingReviewFrontDeskShifts.map((shift) => ({
      id: shift.id,
      type: 'FRONT DESK' as const,
      label: shift.cashAccount.name,
      operator: `${shift.staff.firstName} ${shift.staff.lastName}`,
      status: shift.controlStatus || 'SUBMITTED',
      expected: Number(shift.systemExpectedCash),
      declared: shift.declaredCash == null ? null : Number(shift.declaredCash),
      variance: shift.variance == null ? null : Number(shift.variance),
      updatedAt: shift.updatedAt,
    })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  const reviewExceptions = queueItems.filter((item) => item.status === 'RETURNED').length;
  const controlIssues = pendingDrops + pendingHandoverCount + depositExceptionCount + reviewExceptions;
  const controlPulse = controlIssues === 0 ? 'Clear' : controlIssues < 4 ? 'Monitor' : 'Action needed';

  const businessDateLabel = businessDate.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const kpiCards = [
    {
      label: 'Current Safe Float',
      value: formatCurrency(cashInDrawer, currency),
      icon: Wallet,
      iconBg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-600',
      accent: 'border-l-indigo-500',
      valueColor: 'text-slate-900',
    },
    {
      label: "Today's Consolidated Revenue",
      value: formatCurrency(todayRevenue, currency),
      icon: TrendingUp,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600',
      accent: 'border-l-emerald-500',
      valueColor: 'text-slate-900',
    },
    {
      label: 'Pending Till Drops',
      value: `${pendingDrops} Active`,
      icon: ArrowDownToLine,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600',
      accent: 'border-l-amber-500',
      valueColor: pendingDrops > 0 ? 'text-amber-600' : 'text-slate-900',
    },
    {
      label: 'Petty Cash Payouts',
      value: formatCurrency(pettyCashPayouts, currency),
      icon: ArrowUpFromLine,
      iconBg: 'bg-rose-500/10',
      iconColor: 'text-rose-600',
      accent: 'border-l-rose-500',
      valueColor: 'text-slate-900',
    },
  ];

  const statusMeta: Record<string, { label: string; icon: React.ElementType; pill: string }> = {
    SUBMITTED: {
      label: 'Submitted',
      icon: Clock,
      pill: 'bg-sky-50 text-sky-700 border border-sky-200',
    },
    UNDER_REVIEW: {
      label: 'Under Review',
      icon: RotateCcw,
      pill: 'bg-violet-50 text-violet-700 border border-violet-200',
    },
    RETURNED: {
      label: 'Returned',
      icon: AlertTriangle,
      pill: 'bg-red-50 text-red-700 border border-red-200',
    },
  };

  const quickActions = [
    { label: 'Review submitted shifts', detail: `${queueItems.length} awaiting attention`, href: '/reports/shift', icon: ShieldCheck, tone: 'text-indigo-600 bg-indigo-50' },
    { label: 'Receive handovers', detail: `${pendingHandoverCount} pending custody`, href: '/handovers', icon: Banknote, tone: 'text-amber-600 bg-amber-50' },
    { label: 'Reconcile deposits', detail: `${depositExceptionCount} exception${depositExceptionCount === 1 ? '' : 's'}`, href: '/deposits', icon: Landmark, tone: 'text-emerald-600 bg-emerald-50' },
    { label: 'Follow up receivables', detail: `${receivablesCount} open folio${receivablesCount === 1 ? '' : 's'}`, href: '/reports/receivables', icon: Users, tone: 'text-violet-600 bg-violet-50' },
  ];

  const controlSignals = [
    {
      label: 'Till control',
      detail: pendingDrops === 0 ? 'All active tills accounted for' : `${pendingDrops} active till${pendingDrops === 1 ? '' : 's'} to close`,
      value: pendingDrops,
      tone: pendingDrops === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Cash custody',
      detail: pendingHandoverCount === 0 ? 'No handovers awaiting receipt' : `${formatCurrency(pendingHandoverAmount, currency)} awaiting receipt`,
      value: pendingHandoverCount,
      tone: pendingHandoverCount === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Exceptions',
      detail: depositExceptionCount + reviewExceptions === 0 ? 'No returned reviews or deposit exceptions' : `${depositExceptionCount + reviewExceptions} item${depositExceptionCount + reviewExceptions === 1 ? '' : 's'} need follow-up`,
      value: depositExceptionCount + reviewExceptions,
      tone: depositExceptionCount + reviewExceptions === 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600',
    },
  ];

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="relative overflow-hidden bg-[#0b1120] px-6 py-8 sm:px-8">
        <div className="pointer-events-none absolute -right-16 -top-28 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/2 h-24 w-96 -translate-x-1/2 bg-violet-500/10 blur-3xl" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative">
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.12)]" />
              Finance operations
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Good morning, here&apos;s your control room.</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Keep today&apos;s collections, custody, and exceptions moving from one place.</p>
          </div>
          <div className="relative flex flex-col items-start gap-2 self-start sm:items-end sm:self-auto">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.08] px-3.5 py-2 backdrop-blur-sm">
              <CalendarDays className="h-4 w-4 shrink-0 text-indigo-300" />
              <span className="text-sm font-medium text-slate-200">{businessDateLabel}</span>
            </div>
            <Link href="/reports/shift" className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 transition hover:text-white">Open review queue <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
        </div>
      </div>

      <div className="px-6 py-7 space-y-7 max-w-screen-xl mx-auto">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className={`bg-white rounded-2xl border border-slate-200 shadow-sm border-l-4 ${card.accent} p-5 flex items-start gap-4 hover:shadow-md transition-shadow`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.iconBg}`}>
                  <Icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-500 leading-tight">{card.label}</p>
                  <p className={`text-2xl font-black mt-1 leading-tight tracking-tight ${card.valueColor}`}>
                    {card.value}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Today&apos;s control pulse</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${controlIssues === 0 ? 'bg-emerald-50 text-emerald-700' : controlIssues < 4 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>{controlPulse}</span>
              </div>
              <p className="mt-1 text-sm text-slate-500">A live read on the areas that usually need a cashier&apos;s attention.</p>
            </div>
            <Link href="/reports/shift" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900">View controls <ArrowRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {controlSignals.map((signal) => (
              <div key={signal.label} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 px-4 py-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${signal.tone}`}>{signal.value}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{signal.label}</p>
                  <p className="truncate text-xs text-slate-500">{signal.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Control snapshot */}
        <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-indigo-600">Control snapshot</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">What needs attention today</h2>
                <p className="mt-1 text-sm text-slate-500">A quick view of custody, deposits, and outstanding guest balances.</p>
              </div>
              <Link href="/reports/shift" className="hidden items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900 sm:flex">Open controls <ArrowRight className="h-3.5 w-3.5" /></Link>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-amber-50 p-4">
                <div className="flex items-center justify-between"><Banknote className="h-4 w-4 text-amber-600" /><span className="text-xs font-bold text-amber-700">CUSTODY</span></div>
                <p className="mt-4 text-2xl font-black text-slate-900">{pendingHandoverCount}</p>
                <p className="mt-1 text-xs text-slate-600">handover{pendingHandoverCount === 1 ? '' : 's'} pending</p>
                <p className="mt-3 text-xs font-semibold text-amber-700">{formatCurrency(pendingHandoverAmount, currency)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4">
                <div className="flex items-center justify-between"><Landmark className="h-4 w-4 text-emerald-600" /><span className="text-xs font-bold text-emerald-700">DEPOSITS</span></div>
                <p className="mt-4 text-2xl font-black text-slate-900">{depositExceptionCount}</p>
                <p className="mt-1 text-xs text-slate-600">deposit exception{depositExceptionCount === 1 ? '' : 's'}</p>
                <p className="mt-3 text-xs font-semibold text-emerald-700">{formatCurrency(depositPipelineAmount, currency)} in pipeline</p>
              </div>
              <div className="rounded-xl bg-violet-50 p-4">
                <div className="flex items-center justify-between"><Users className="h-4 w-4 text-violet-600" /><span className="text-xs font-bold text-violet-700">RECEIVABLES</span></div>
                <p className="mt-4 text-2xl font-black text-slate-900">{receivablesCount}</p>
                <p className="mt-1 text-xs text-slate-600">open guest folio{receivablesCount === 1 ? '' : 's'}</p>
                <p className="mt-3 text-xs font-semibold text-violet-700">{formatCurrency(receivablesAmount, currency)} outstanding</p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {quickActions.map((action) => {
                const ActionIcon = action.icon;
                return <Link key={action.label} href={action.href} className="group flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-indigo-200 hover:bg-slate-50"><span className={`flex h-9 w-9 items-center justify-center rounded-lg ${action.tone}`}><ActionIcon className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-800">{action.label}</span><span className="block text-xs text-slate-500">{action.detail}</span></span><ArrowRight className="h-4 w-4 text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-indigo-600" /></Link>;
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-600">Payment intelligence</p><h2 className="mt-1 text-lg font-semibold text-slate-900">Today&apos;s collection mix</h2><p className="mt-1 text-sm text-slate-500">Confirmed front-desk and POS collections by method.</p></div><TrendingUp className="h-5 w-5 text-emerald-500" /></div>
            {paymentMixRows.length === 0 ? <div className="flex h-48 items-center justify-center text-sm text-slate-400">No confirmed collections yet.</div> : <div className="mt-7 space-y-5">{paymentMixRows.slice(0, 5).map(([method, amount], index) => { const percentage = paymentMixTotal ? (amount / paymentMixTotal) * 100 : 0; return <div key={method}><div className="mb-2 flex items-center justify-between text-sm"><span className="font-medium capitalize text-slate-700">{method.replace(/_/g, ' ').toLowerCase()}</span><span className="font-semibold text-slate-900">{formatCurrency(amount, currency)}</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${index === 0 ? 'bg-indigo-500' : index === 1 ? 'bg-emerald-500' : index === 2 ? 'bg-amber-500' : 'bg-slate-400'}`} style={{ width: `${percentage}%` }} /></div><p className="mt-1 text-right text-[11px] text-slate-400">{percentage.toFixed(1)}% of collections</p></div>; })}</div>}
            <div className="mt-6 border-t border-slate-100 pt-4"><div className="flex items-center justify-between text-xs"><span className="font-medium text-slate-500">Total confirmed collections</span><span className="font-bold text-slate-900">{formatCurrency(paymentMixTotal, currency)}</span></div></div>
          </section>
        </div>

        {/* Pending Review Queue */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Pending Review Queue</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Shifts submitted by operators requiring General Cashier approval.
              </p>
            </div>
            {queueItems.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-[24px] h-6 px-2 rounded-full bg-indigo-600 text-white text-xs font-bold">
                {queueItems.length}
              </span>
            )}
          </div>

          {queueItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <div className="h-16 w-16 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-slate-700">All caught up!</p>
              <p className="text-sm text-slate-400 mt-1">All shifts have been reviewed and approved.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50/80">
                    <th className="text-left px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Type</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Location</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Operator</th>
                    <th className="text-left px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                    <th className="text-right px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Expected</th>
                    <th className="text-right px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Declared</th>
                    <th className="text-right px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Variance</th>
                    <th className="text-right px-6 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {queueItems.map((item) => {
                    const meta = statusMeta[item.status] || statusMeta['SUBMITTED'];
                    const StatusIcon = meta.icon;
                    const varianceNegative = item.variance !== null && item.variance < 0;
                    const variancePositive = item.variance !== null && item.variance > 0;
                    return (
                      <tr
                        key={`${item.type}-${item.id}`}
                        className="hover:bg-slate-50/70 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                              item.type === 'POS'
                                ? 'bg-blue-50 text-blue-700 border-blue-200'
                                : 'bg-purple-50 text-purple-700 border-purple-200'
                            }`}
                          >
                            {item.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-semibold text-slate-800">{item.label}</td>
                        <td className="px-6 py-4 text-slate-600">{item.operator}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${meta.pill}`}>
                            <StatusIcon className="h-3 w-3" />
                            {meta.label}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-700">
                          {formatCurrency(item.expected, currency)}
                        </td>
                        <td className="px-6 py-4 text-right font-medium text-slate-700">
                          {item.declared == null ? (
                            <span className="text-slate-400">—</span>
                          ) : (
                            formatCurrency(item.declared, currency)
                          )}
                        </td>
                        <td
                          className={`px-6 py-4 text-right font-semibold ${
                            varianceNegative
                              ? 'text-red-600'
                              : variancePositive
                              ? 'text-amber-600'
                              : 'text-emerald-600'
                          }`}
                        >
                          {item.variance == null ? (
                            <span className="text-slate-400 font-normal">—</span>
                          ) : (
                            formatCurrency(item.variance, currency)
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/reports/shift?shiftId=${encodeURIComponent(item.id)}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-colors"
                          >
                            Review
                            <ArrowRight className="h-3 w-3" />
                          </Link>
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
