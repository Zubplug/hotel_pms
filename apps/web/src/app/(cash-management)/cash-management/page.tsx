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
  ]);

  const currency = property.baseCurrency;
  const todayRevenue =
    Number(revenue._sum?.amount || 0) + Number(frontDeskRevenue._sum?.amount || 0);
  const cashInDrawer = Number(safeAccount?.balance || 0);
  const pettyCashPayouts = Number(pettyCash._sum?.amount || 0);
  const pendingDrops = activeOutletShifts.length + activeFrontDeskShifts.length;

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

  return (
    <div className="min-h-full">
      {/* Hero header */}
      <div className="bg-gradient-to-r from-[#0b1120] to-[#1e2d50] px-8 py-7">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              General Cashier Workspace
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Manage central hotel finances, folios, till drops, and pending reviews.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-4 py-2 self-start sm:self-auto backdrop-blur-sm">
            <CalendarDays className="h-4 w-4 text-indigo-300 shrink-0" />
            <span className="text-sm font-medium text-slate-200">{businessDateLabel}</span>
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
