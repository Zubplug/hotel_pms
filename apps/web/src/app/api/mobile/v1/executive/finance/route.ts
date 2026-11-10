import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { getPropertyBusinessDate, calculateDailyRevenue } from '@/lib/kpi';
import { prisma } from '@hotel-pms/db';
import { addDays, endOfDay, format, startOfDay, startOfMonth, startOfYear, subDays } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { DailyAccountingService } from '@/lib/services/daily-accounting-service';
import { getReceivablesPosition } from '@/lib/services/receivables-position-service';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const ctx = await requireOrganizationContext(user.id);
    const primaryPropertyId = ctx.propertyIds[0];
    if (!primaryPropertyId) return errorResponse('FORBIDDEN', 'No property access', 403);

    const property = await prisma.property.findUnique({
      where: { id: primaryPropertyId },
      select: { id: true, name: true, timezone: true, baseCurrency: true, settings: true },
    });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    const businessDate = await getPropertyBusinessDate(primaryPropertyId);
    const period = req.nextUrl.searchParams.get('period')?.toUpperCase() || 'TODAY';
    const businessDateLabel = format(businessDate, 'yyyy-MM-dd');
    const propertyDayStart = (date: Date) => fromZonedTime(`${format(date, 'yyyy-MM-dd')}T00:00:00`, property.timezone);
    const propertyDayEnd = (date: Date) => fromZonedTime(`${format(date, 'yyyy-MM-dd')}T23:59:59.999`, property.timezone);
    const businessDayStart = propertyDayStart(businessDate);
    const businessDayEnd = propertyDayEnd(businessDate);

    // ── 1. Determine Date Boundaries for Models ──────────────────────────────
    const lastAudit = await prisma.nightAudit.findFirst({
      where: { propertyId: primaryPropertyId, status: 'COMPLETED', businessDate: { lte: businessDate } },
      orderBy: { businessDate: 'desc' },
      include: { financialSnapshot: true } // Included to get breakdown fields
    });

    const auditedBusinessDate = lastAudit?.businessDate ?? null;
    const reportStartBusinessDate = period === '7D'
      ? subDays(businessDate, 6)
      : period === 'MTD'
        ? startOfMonth(businessDate)
        : period === 'YTD'
          ? startOfYear(businessDate)
          : auditedBusinessDate;
    const isRangeReport = ['7D', 'MTD', 'YTD'].includes(period);
    const auditedRows = isRangeReport
      ? await prisma.nightAudit.findMany({
          where: {
            propertyId: primaryPropertyId,
            status: 'COMPLETED',
            businessDate: {
              gte: reportStartBusinessDate ? propertyDayStart(reportStartBusinessDate) : businessDayStart,
              lte: businessDayEnd,
            },
          },
          orderBy: { businessDate: 'asc' },
          include: { financialSnapshot: true },
        })
      : lastAudit ? [lastAudit] : [];

    // B) Live Folio Items & Sessions (businessDate > auditedBusinessDate)
    const liveBusinessDateStart = auditedBusinessDate
      ? propertyDayStart(addDays(auditedBusinessDate, 1))
      : businessDayStart;
    const liveBusinessDateFilter = { gte: liveBusinessDateStart, lte: businessDayEnd };

    // C) Real-time transactions like Payments & Approvals (createdAt / calendar date)
    const now = new Date();
    let calendarStartDate = businessDayStart;
    const calendarEndDate = now;
    if (period === '7D') calendarStartDate = propertyDayStart(subDays(businessDate, 6));
    if (period === 'MTD') calendarStartDate = propertyDayStart(startOfMonth(businessDate));
    if (period === 'YTD') calendarStartDate = propertyDayStart(startOfYear(businessDate));

    // D) Cash Sessions (businessDate)
    // For TODAY: show only live sessions (businessDate >= liveBusinessDateStart)
    // For MTD/YTD: show sessions for the entire period up to now
    let sessionStartDate = liveBusinessDateStart;
    if (period === '7D') sessionStartDate = propertyDayStart(subDays(businessDate, 6));
    if (period === 'MTD') sessionStartDate = propertyDayStart(startOfMonth(businessDate));
    if (period === 'YTD') sessionStartDate = propertyDayStart(startOfYear(businessDate));
    const sessionEndDate = businessDayEnd;
    // Uses calculateDailyRevenue from kpi.ts — the exact same function as the home
    // screen dashboard — so Finance screen figures are guaranteed to match.
    let audited = {
      revenue: 0, roomRevenue: 0, fbRevenue: 0, otherRevenue: 0,
      discounts: 0, refunds: 0, netRevenue: 0,
    };

    for (const audit of auditedRows) {
      audited.roomRevenue += Number(audit.totalRoomRevenue || 0);
      audited.revenue += Number(audit.totalRevenue || 0);
      audited.netRevenue += Number(audit.totalRevenue || 0);
      if (audit.financialSnapshot) {
        audited.fbRevenue += Number(audit.financialSnapshot.fnbRevenue || 0);
        audited.otherRevenue += Number(audit.financialSnapshot.otherRevenue || 0);
        audited.discounts += Number(audit.financialSnapshot.discounts || 0);
        audited.refunds += Number(audit.financialSnapshot.refunds || 0);
      }
    }

    // Finance reporting is presented from posted GL revenue accounts. The
    // Night Audit snapshot remains the headline control total, while this
    // account-level view explains how that audited total is distributed.
    const accountRevenue = lastAudit
      ? (await DailyAccountingService.getDailyRevenue(primaryPropertyId, auditedBusinessDate!)).rows
      : [];
    const departmentTotals = new Map<string, number>();
    for (const row of accountRevenue) {
      departmentTotals.set(row.department, (departmentTotals.get(row.department) || 0) + row.netRevenue);
    }
    const departmentRevenue = Array.from(departmentTotals.entries())
      .map(([department, netRevenue]) => ({ department, netRevenue: Number(netRevenue.toFixed(2)) }))
      .sort((a, b) => Math.abs(b.netRevenue) - Math.abs(a.netRevenue));
    const auditedOtherItems = auditedRows.length
      ? await prisma.folioItem.findMany({
          where: {
            folio: { propertyId: primaryPropertyId },
            businessDate: isRangeReport
              ? { gte: propertyDayStart(reportStartBusinessDate!), lte: businessDayEnd }
              : auditedBusinessDate!,
            type: 'CHARGE',
            voidedAt: null,
          },
          select: { amount: true, source: true, revenueCategory: true, revenueClass: true },
        })
      : [];
    const otherBreakdownTotals = new Map<string, number>();
    const ancillaryLabels: Record<string, string> = {
      SPA: 'Spa',
      LAUNDRY: 'Laundry',
      TRANSPORT: 'Transport',
      TELEPHONE: 'Telephone',
      INTERNET: 'Internet',
      MINIBAR: 'Minibar',
      MANUAL: 'Manual Revenue',
    };
    for (const item of auditedOtherItems) {
      const source = String(item.source).toUpperCase();
      const category = String(item.revenueCategory).toUpperCase();
      const revenueClass = String(item.revenueClass || '').toUpperCase();
      let label: string | null = null;
      if (revenueClass === 'HALL') label = 'Events · Hall';
      else if (revenueClass === 'EQUIPMENT') label = 'Events · Equipment';
      else if (revenueClass === 'FOOD' && source === 'OTHER') label = 'Events · Food';
      else if ((source === 'ROOM_CHARGE' || source === 'DAY_USE_ROOM_CHARGE') && category === 'OTHER') label = 'Service Charge';
      else if (category === 'OTHER') label = source === 'CITY_LEDGER' ? 'City Ledger Credit' : (ancillaryLabels[source] || 'Other Operating Revenue');
      if (label) otherBreakdownTotals.set(label, (otherBreakdownTotals.get(label) || 0) + Number(item.amount));
    }
    const otherRevenueBreakdown = Array.from(otherBreakdownTotals.entries())
      .map(([department, netRevenue]) => ({ department, netRevenue: Number(netRevenue.toFixed(2)) }))
      .filter((row) => Math.abs(row.netRevenue) > 0.01)
      .sort((a, b) => Math.abs(b.netRevenue) - Math.abs(a.netRevenue));
    const classifiedOtherTotal = otherRevenueBreakdown.reduce((sum, row) => sum + row.netRevenue, 0);
    const otherResidual = Number((audited.otherRevenue - classifiedOtherTotal).toFixed(2));
    if (Math.abs(otherResidual) > 0.01) {
      otherRevenueBreakdown.push({ department: 'Unclassified Other Revenue', netRevenue: otherResidual });
    }
    const auditedDepartmentRevenue = [
      { department: 'Rooms', netRevenue: Number(audited.roomRevenue.toFixed(2)) },
      { department: 'Food & Beverage', netRevenue: Number(audited.fbRevenue.toFixed(2)) },
      ...otherRevenueBreakdown,
    ].filter((row) => Math.abs(row.netRevenue) > 0.01);

    // ── 3. Live Since Last Audit (Unaudited Activity) ──────────────────────
    // Uses calculateDailyRevenue for businessDate (today) so live figures also
    // match what the home screen shows as "LIVE TODAY".
    const liveRevData = await calculateDailyRevenue(primaryPropertyId, businessDate);

    // Payments collected since last audit (real-time)
    const livePayments = await prisma.payment.findMany({
      where: {
        propertyId: primaryPropertyId,
        status: 'COMPLETED',
        createdAt: { gte: lastAudit?.completedAt ?? businessDayStart, lte: now },
      },
      select: { amount: true },
    });
    const liveCollections = livePayments.reduce((s: number, p: any) => s + Number(p.amount), 0);

    const liveSinceLastAudit = {
      revenueActivity: liveRevData.totalRevenue,
      roomCharges: liveRevData.roomRevenue,
      posSales: liveRevData.fbRevenue + liveRevData.barRevenue,
      collections: liveCollections,
    };

    // ── 4. Cash Control (Variance reporting) ───────────────────────────────
    const fdSessions = await prisma.frontdeskSession.findMany({
      // Cash Control is an operational view: show only shifts that are
      // currently active, not historical closed/reconciled sessions.
      where: { propertyId: primaryPropertyId, status: 'OPEN', controlStatus: 'OPEN' },
      include: { staff: { select: { firstName: true, lastName: true } } },
    });
    
    const posSessions = await prisma.posSession.findMany({
      where: { outlet: { propertyId: primaryPropertyId }, status: 'OPEN', controlStatus: 'OPEN' },
      include: { outlet: { select: { name: true } } },
    });

    const toStatus = (v: number | null) =>
      v === null ? 'OPEN' : v === 0 ? 'OK' : v < 0 ? 'VARIANCE' : 'OVERAGE';

    const allSessions = [
      ...fdSessions.map(s => ({
        label: `FD – ${s.staff.firstName} ${s.staff.lastName}`,
        expected: Number(s.systemExpectedCash),
        declared: s.declaredCash !== null ? Number(s.declaredCash) : null,
        variance: s.variance !== null ? Number(s.variance) : null,
        status: toStatus(s.variance !== null ? Number(s.variance) : null),
        businessDate: format(s.businessDate, 'yyyy-MM-dd'),
      })),
      ...posSessions.map(s => ({
        label: s.outlet.name,
        expected: Number(s.expectedCash),
        declared: s.actualCash !== null ? Number(s.actualCash) : null,
        variance: s.variance !== null ? Number(s.variance) : null,
        status: toStatus(s.variance !== null ? Number(s.variance) : null),
        businessDate: format(s.businessDate, 'yyyy-MM-dd'),
      })),
    ];
    
    allSessions.sort((a, b) => b.businessDate.localeCompare(a.businessDate));

    const totalExpected = allSessions.reduce((s: number, c: any) => s + c.expected, 0);
    const totalDeclared = allSessions.reduce((s: number, c: any) => s + (c.declared ?? 0), 0);
    const totalVariance = allSessions.reduce((s: number, c: any) => s + (c.variance ?? 0), 0);
    const sessionsWithVariance = allSessions.filter(s => s.variance !== null && s.variance !== 0);
    const significantVariances = sessionsWithVariance.filter(s => Math.abs(s.variance!) > 5000).length;

    const cashControl = {
      expected: totalExpected,
      declared: totalDeclared,
      variance: totalVariance,
      sessionsWithVariance: sessionsWithVariance.length,
      significantVariances,
      sessions: allSessions,
    };

    // ── 5. Transaction Controls (Using exact dates) ────────────────────────
    const controlStartDate = period === 'LAST_AUDIT' || period === 'TODAY' ? liveBusinessDateStart : sessionStartDate;
    const controlEndDate = sessionEndDate;

    const [discountAgg, voidedItemsControl, refundAgg, overrideCount] = await Promise.all([
      prisma.folioItem.aggregate({
        where: { folio: { propertyId: primaryPropertyId }, type: 'DISCOUNT', voidedAt: null, businessDate: { gte: controlStartDate, lte: controlEndDate } },
        _sum: { amount: true },
      }),
      prisma.folioItem.findMany({
        where: { folio: { propertyId: primaryPropertyId }, type: 'CHARGE', voidedAt: { gte: calendarStartDate, lte: calendarEndDate } }, // Voids happen in real-time
        select: { amount: true },
      }),
      prisma.folioItem.aggregate({
        where: { folio: { propertyId: primaryPropertyId }, type: 'REFUND', voidedAt: null, businessDate: { gte: controlStartDate, lte: controlEndDate } },
        _sum: { amount: true },
      }),
      prisma.approvalRequest.count({
        where: { propertyId: primaryPropertyId, createdAt: { gte: calendarStartDate, lte: calendarEndDate } }, // Approvals are real-time
      }),
    ]);

    const transactionControls = {
      discounts: Math.abs(Number(discountAgg._sum.amount || 0)),
      voids: voidedItemsControl.reduce((s: number, i: any) => s + Number(i.amount), 0),
      refunds: Math.abs(Number(refundAgg._sum.amount || 0)),
      overrides: overrideCount,
    };

    // ── 6. Current Alerts (Global, real-time) ──────────────────────────────
    const currentAlerts: Array<{ id: string; priority: string; category: string; title: string; summary: string; affectedCount: number; totalAmount: number }> = [];
    const settings = (property.settings as Record<string, any>) || {};
    const highBalThreshold = settings.financial?.highBalanceThreshold || 150000;

    const openFolios = await prisma.folio.findMany({
      where: { propertyId: primaryPropertyId, type: { not: 'CITY_LEDGER' }, status: 'OPEN', balance: { gt: 0 } },
      select: { balance: true },
    });
    const receivablesPosition = await getReceivablesPosition(primaryPropertyId, now);

    const highBalanceFolios = openFolios.filter((f: any) => Number(f.balance) > highBalThreshold);
    if (highBalanceFolios.length > 0) {
      currentAlerts.push({
        id: 'high-balance', priority: 'P0', category: 'RECEIVABLES',
        title: 'High Guest Balance',
        summary: `${highBalanceFolios.length} accounts exceed ₦${(highBalThreshold / 1000).toFixed(0)}K threshold`,
        affectedCount: highBalanceFolios.length,
        totalAmount: highBalanceFolios.reduce((s: number, f: any) => s + Number(f.balance), 0),
      });
    }

    // Checking current day variances for alerts
    const todayVariances = allSessions.filter(s => s.businessDate === businessDateLabel && s.variance !== null && s.variance < 0);
    const todayVarianceTotal = todayVariances.reduce((s, a) => s + Math.abs(a.variance!), 0);
    if (todayVarianceTotal > 5000) {
      currentAlerts.push({
        id: 'cash-variance', priority: 'P0', category: 'CASH CONTROL',
        title: 'Cashier Variance Detected',
        summary: 'Cash declared does not match system expected today',
        affectedCount: todayVariances.length,
        totalAmount: todayVarianceTotal,
      });
    }

    const pendingRefunds = await prisma.refund.findMany({
      where: { propertyId: primaryPropertyId, status: 'PENDING' },
      select: { amount: true },
    });
    if (pendingRefunds.length > 0) {
      currentAlerts.push({
        id: 'pending-refunds', priority: 'P1', category: 'FINANCE',
        title: 'Refunds Awaiting Approval',
        summary: `${pendingRefunds.length} refund(s) pending review`,
        affectedCount: pendingRefunds.length,
        totalAmount: pendingRefunds.reduce((s: number, r: any) => s + Number(r.amount), 0),
      });
    }

    // ── 7. Guest Credits & Outstanding ─────────────────────────────────────
    const guestCredits = {
      depositsHeld: receivablesPosition.depositsHeld,
      creditsAvailable: receivablesPosition.availableCredits,
      creditsConsumed: receivablesPosition.consumedCredits,
      guestFolioCredits: receivablesPosition.guestFolioCredits,
    };

    const outstanding = {
      total: receivablesPosition.totalReceivables,
      guestBalances: receivablesPosition.guestReceivables,
      corporateReceivables: receivablesPosition.corporateReceivables,
      other: receivablesPosition.otherReceivables,
    };

    if (receivablesPosition.totalReceivables > 1_000_000) {
      currentAlerts.push({
        id: 'outstanding-receivables', priority: 'P1', category: 'RECEIVABLES',
        title: 'Outstanding Receivables',
        summary: `₦${(receivablesPosition.totalReceivables / 1_000_000).toFixed(2)}M in guest and city-ledger balances`,
        affectedCount: receivablesPosition.receivableAccountCount,
        totalAmount: receivablesPosition.totalReceivables,
      });
    }

    // Cash Management dashboard snapshot. Keep this alongside the existing
    // finance response so mobile cashier users share the same property and
    // business-date scope without a second dashboard query.
    const [cashierSafe, pendingHandover, pendingDeposit, cashierReview] = await Promise.all([
      prisma.cashAccount.findFirst({
        where: { propertyId: primaryPropertyId, type: 'SAFE', isActive: true },
        select: { balance: true },
      }),
      prisma.cashHandover.aggregate({
        where: { propertyId: primaryPropertyId, status: 'PENDING' },
        _count: { id: true },
        _sum: { amount: true },
      }),
      prisma.bankDeposit.aggregate({
        where: {
          propertyId: primaryPropertyId,
          status: { in: ['PENDING_HANDOVER', 'HANDED_OVER', 'UNDER_RECONCILIATION', 'EXCEPTION'] },
        },
        _count: { id: true },
        _sum: { expectedAmount: true },
      }),
      Promise.all([
        prisma.frontdeskSession.count({ where: { propertyId: primaryPropertyId, controlStatus: { in: ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED'] } } }),
        prisma.posSession.count({ where: { outlet: { propertyId: primaryPropertyId }, controlStatus: { in: ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED'] } } }),
      ]),
    ]);

    // Collection intelligence for the cashier dashboard. Keep the payload
    // intentionally small: this is a decision summary, not a transaction log.
    const [todayPosPayments, todayFrontDeskPayments] = await Promise.all([
      prisma.posPayment.findMany({
        where: {
          order: { propertyId: primaryPropertyId },
          businessDate,
          status: { in: ['CONFIRMED', 'PAID'] },
          amount: { gt: 0 },
        },
        select: { method: true, amount: true, order: { select: { outlet: { select: { name: true } } } } },
      }),
      prisma.payment.findMany({
        where: {
          propertyId: primaryPropertyId,
          businessDate,
          status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] },
          amount: { gt: 0 },
        },
        select: { method: true, amount: true, frontdeskSession: { select: { cashAccount: { select: { name: true } } } } },
      }),
    ]);
    const paymentMethodTotals = new Map<string, number>();
    const outletTotals = new Map<string, number>();
    const addCollection = (method: string, outlet: string, amount: number) => {
      paymentMethodTotals.set(method, (paymentMethodTotals.get(method) || 0) + amount);
      outletTotals.set(outlet, (outletTotals.get(outlet) || 0) + amount);
    };
    todayPosPayments.forEach((payment) => addCollection(String(payment.method), payment.order.outlet.name, Number(payment.amount)));
    todayFrontDeskPayments.forEach((payment) => addCollection(String(payment.method), payment.frontdeskSession?.cashAccount.name || 'Front Desk', Number(payment.amount)));
    const collectionMethods = Array.from(paymentMethodTotals.entries()).map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount);
    const collectionOutlets = Array.from(outletTotals.entries()).map(([outlet, amount]) => ({ outlet, amount })).sort((a, b) => b.amount - a.amount);
    const todayCollections = collectionMethods.reduce((sum, row) => sum + row.amount, 0);

    // ── Response ───────────────────────────────────────────────────────────
    return successResponse({
      period,
      businessDate: businessDateLabel,
      lastAuditedBusinessDate: auditedBusinessDate ? format(auditedBusinessDate, 'yyyy-MM-dd') : null,
      property: { name: property.name, currency: property.baseCurrency || 'NGN' },
      audited: { ...audited, otherRevenueBreakdown },
      accountRevenue,
      departmentRevenue: auditedDepartmentRevenue,
      postedDepartmentRevenue: departmentRevenue,
      liveSinceLastAudit,
      cashControl,
      cashier: {
        safeBalance: Number(cashierSafe?.balance || 0),
        pendingHandovers: pendingHandover._count.id,
        pendingHandoverValue: Number(pendingHandover._sum.amount || 0),
        pendingDeposits: pendingDeposit._count.id,
        pendingDepositValue: Number(pendingDeposit._sum.expectedAmount || 0),
        sessionsAwaitingReview: cashierReview[0] + cashierReview[1],
        todayCollections,
        collectionMethods,
        collectionOutlets,
      },
      transactionControls,
      outstanding,
      guestCredits,
      currentAlerts,
    }, 200);
  } catch (err: any) {
    console.error('[Mobile Executive Finance API]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating executive finance dashboard', 500);
  }
}
