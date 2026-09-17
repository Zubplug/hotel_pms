import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { getPropertyBusinessDate, calculateDailyRevenue } from '@/lib/kpi';
import { prisma } from '@hotel-pms/db';
import { addDays, endOfDay, format, startOfDay, startOfMonth, startOfYear } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';

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
      select: { businessDate: true, completedAt: true, totalRevenue: true, totalRoomRevenue: true },
    });

    const auditedBusinessDate = lastAudit?.businessDate ?? null;

    // A) Audited Folio Items (businessDate)
    let auditedStartDate: Date | null = null;
    let auditedEndDate: Date | null = null;
    if (auditedBusinessDate) {
      if (period === 'MTD' || period === 'MONTH') {
        auditedStartDate = propertyDayStart(startOfMonth(businessDate));
      } else if (period === 'YTD' || period === 'YEAR') {
        auditedStartDate = propertyDayStart(startOfYear(businessDate));
      } else if (period === 'WEEK') {
        auditedStartDate = propertyDayStart(addDays(auditedBusinessDate, -6));
      } else {
        auditedStartDate = propertyDayStart(auditedBusinessDate);
      }
      auditedEndDate = propertyDayEnd(auditedBusinessDate);
    }

    // B) Live Folio Items & Sessions (businessDate > auditedBusinessDate)
    const liveBusinessDateStart = auditedBusinessDate
      ? propertyDayStart(addDays(auditedBusinessDate, 1))
      : businessDayStart;
    const liveBusinessDateFilter = { gte: liveBusinessDateStart, lte: businessDayEnd };

    // C) Real-time transactions like Payments & Approvals (createdAt / calendar date)
    const now = new Date();
    let calendarStartDate = businessDayStart;
    const calendarEndDate = now;
    if (period === 'MTD') calendarStartDate = propertyDayStart(startOfMonth(businessDate));
    if (period === 'YTD') calendarStartDate = propertyDayStart(startOfYear(businessDate));

    // D) Cash Sessions (businessDate)
    // For TODAY: show only live sessions (businessDate >= liveBusinessDateStart)
    // For MTD/YTD: show sessions for the entire period up to now
    let sessionStartDate = liveBusinessDateStart;
    if (period === 'MTD') sessionStartDate = propertyDayStart(startOfMonth(businessDate));
    if (period === 'YTD') sessionStartDate = propertyDayStart(startOfYear(businessDate));
    const sessionEndDate = businessDayEnd;
    // Uses calculateDailyRevenue from kpi.ts — the exact same function as the home
    // screen dashboard — so Finance screen figures are guaranteed to match.
    let audited = {
      revenue: 0, roomRevenue: 0, fbRevenue: 0, otherRevenue: 0,
      discounts: 0, refunds: 0, netRevenue: 0,
    };

    if (auditedBusinessDate && auditedStartDate && auditedEndDate) {
      // ── Revenue via NightAudit table (matches home screen exactly) ──
      // This correctly aggregates if period is MTD/YTD, and captures the exact
      // locked-in figures from the Night Audit, rather than live recalculated data.
      const rawAudits = await prisma.nightAudit.findMany({
        where: {
          propertyId: primaryPropertyId,
          status: 'COMPLETED',
          businessDate: { gte: auditedStartDate, lte: auditedEndDate },
        },
        orderBy: { completedAt: 'desc' }, // Latest first so we can deduplicate
        include: { financialSnapshot: true },
      });

      // Deduplicate: If there are multiple NightAudit runs for the exact same businessDate,
      // we only want to count the final (most recent) one.
      const uniqueAuditsMap = new Map<number, any>();
      for (const audit of rawAudits) {
        const time = audit.businessDate.getTime();
        if (!uniqueAuditsMap.has(time)) {
          uniqueAuditsMap.set(time, audit);
        }
      }
      
      const audits = Array.from(uniqueAuditsMap.values());

      for (const audit of audits) {
        audited.roomRevenue += Number(audit.totalRoomRevenue || 0);
        if (audit.financialSnapshot) {
          audited.fbRevenue += Number(audit.financialSnapshot.fnbRevenue || 0);
          audited.otherRevenue += Number(audit.financialSnapshot.otherRevenue || 0);
          audited.discounts += Number(audit.financialSnapshot.discounts || 0);
          audited.refunds += Number(audit.financialSnapshot.refunds || 0);
          // Only add to gross/net if financialSnapshot exists
          // Note: home screen 'lastAudit.totalRevenue' is what they show as the main figure.
          audited.revenue += Number(audit.totalRevenue || 0);
          audited.netRevenue += Number(audit.totalRevenue || 0);
        } else {
          // Fallback if financialSnapshot doesn't exist for some reason
          audited.revenue += Number(audit.totalRevenue || 0);
          audited.netRevenue += Number(audit.totalRevenue || 0);
        }
      }
    }

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
      where: { propertyId: primaryPropertyId, businessDate: { gte: sessionStartDate, lte: sessionEndDate } },
      include: { staff: { select: { firstName: true, lastName: true } } },
    });
    
    const posSessions = await prisma.posSession.findMany({
      where: { outlet: { propertyId: primaryPropertyId }, businessDate: { gte: sessionStartDate, lte: sessionEndDate } },
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
      sessions: period === 'TODAY' ? allSessions : [], // Only include detailed list for TODAY
    };

    // ── 5. Transaction Controls (Using exact dates) ────────────────────────
    const controlStartDate = period === 'TODAY' ? liveBusinessDateStart : sessionStartDate;
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
      where: { propertyId: primaryPropertyId, status: 'OPEN', balance: { gt: 0 } },
      select: { balance: true, reservation: { select: { corporateAccountId: true } } },
    });

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
    const outstandingTotal = openFolios.reduce((s: number, f: any) => s + Number(f.balance), 0);
    const guestBalances = openFolios.filter((f: any) => !f.reservation?.corporateAccountId).reduce((s: number, f: any) => s + Number(f.balance), 0);
    const corporateReceivables = openFolios.filter((f: any) => f.reservation?.corporateAccountId).reduce((s: number, f: any) => s + Number(f.balance), 0);

    const [availableAgg, consumedAgg, allAgg] = await Promise.all([
      prisma.folioCredit.aggregate({
        where: { propertyId: primaryPropertyId, status: { in: ['AVAILABLE', 'PARTIALLY_APPLIED'] } },
        _sum: { remainingAmount: true },
      }),
      prisma.folioCreditApplication.aggregate({
        where: { credit: { propertyId: primaryPropertyId }, businessDate: { gte: controlStartDate, lte: controlEndDate } },
        _sum: { amount: true },
      }),
      prisma.folioCredit.aggregate({
        where: { propertyId: primaryPropertyId, status: { not: 'REFUNDED' }, createdAt: { gte: calendarStartDate, lte: calendarEndDate } },
        _sum: { amount: true },
      }),
    ]);

    const guestCredits = {
      depositsHeld: Number(allAgg._sum.amount || 0),
      creditsAvailable: Number(availableAgg._sum.remainingAmount || 0),
      creditsConsumed: Number(consumedAgg._sum.amount || 0),
    };

    const outstanding = { total: outstandingTotal, guestBalances, corporateReceivables, other: 0 };

    if (outstandingTotal > 1_000_000) {
      currentAlerts.push({
        id: 'outstanding-receivables', priority: 'P1', category: 'RECEIVABLES',
        title: 'Outstanding Receivables',
        summary: `₦${(outstandingTotal / 1_000_000).toFixed(2)}M in open folio balances`,
        affectedCount: openFolios.length,
        totalAmount: outstandingTotal,
      });
    }

    // ── Response ───────────────────────────────────────────────────────────
    return successResponse({
      period,
      businessDate: businessDateLabel,
      lastAuditedBusinessDate: auditedBusinessDate ? format(auditedBusinessDate, 'yyyy-MM-dd') : null,
      property: { name: property.name, currency: property.baseCurrency || 'NGN' },
      audited,
      liveSinceLastAudit,
      cashControl,
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
