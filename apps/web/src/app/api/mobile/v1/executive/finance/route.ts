import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { getPropertyBusinessDate } from '@/lib/kpi';
import { prisma } from '@hotel-pms/db';
import { startOfDay, endOfDay, startOfMonth, startOfYear } from 'date-fns';

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

    // ── 1. Determine Date Boundaries for Models ──────────────────────────────
    const lastAudit = await prisma.nightAudit.findFirst({
      where: { propertyId: primaryPropertyId, status: 'COMPLETED' },
      orderBy: { businessDate: 'desc' },
      select: { businessDate: true, completedAt: true, totalRevenue: true, totalRoomRevenue: true },
    });

    const auditedBusinessDate = lastAudit?.businessDate ?? null;

    // A) Audited Folio Items (businessDate)
    let auditedStartDate: Date | null = null;
    let auditedEndDate: Date | null = null;
    if (auditedBusinessDate) {
      if (period === 'MTD') {
        auditedStartDate = startOfMonth(auditedBusinessDate);
      } else if (period === 'YTD') {
        auditedStartDate = startOfYear(auditedBusinessDate);
      } else {
        auditedStartDate = startOfDay(auditedBusinessDate);
      }
      auditedEndDate = endOfDay(auditedBusinessDate);
    }

    // B) Live Folio Items & Sessions (businessDate > auditedBusinessDate)
    const liveBusinessDateStart = auditedBusinessDate ? new Date(auditedBusinessDate.getTime() + 86400000) : startOfDay(businessDate); // Next day
    const liveBusinessDateFilter = { gte: startOfDay(liveBusinessDateStart) }; 

    // C) Real-time transactions like Payments & Approvals (createdAt / calendar date)
    const now = new Date();
    let calendarStartDate = startOfDay(now);
    const calendarEndDate = endOfDay(now);
    if (period === 'MTD') calendarStartDate = startOfMonth(now);
    if (period === 'YTD') calendarStartDate = startOfYear(now);

    // D) Cash Sessions (businessDate)
    // For TODAY: show only live sessions (businessDate >= liveBusinessDateStart)
    // For MTD/YTD: show sessions for the entire period up to now
    let sessionStartDate = liveBusinessDateStart;
    if (period === 'MTD') sessionStartDate = auditedBusinessDate ? startOfMonth(auditedBusinessDate) : startOfMonth(businessDate);
    if (period === 'YTD') sessionStartDate = auditedBusinessDate ? startOfYear(auditedBusinessDate) : startOfYear(businessDate);


    // ── 2. Audited Revenue (Strictly from audited days) ────────────────────
    let audited = {
      revenue: 0, roomRevenue: 0, fbRevenue: 0, otherRevenue: 0,
      discounts: 0, refunds: 0, netRevenue: 0,
    };

    if (auditedBusinessDate && auditedStartDate && auditedEndDate) {
      const [chargeItems, voidedItems] = await Promise.all([
        prisma.folioItem.findMany({
          where: {
            folio: { propertyId: primaryPropertyId },
            businessDate: { gte: auditedStartDate, lte: auditedEndDate },
            voidedAt: null,
          },
          select: { amount: true, type: true, source: true },
        }),
        prisma.folioItem.findMany({
          where: {
            folio: { propertyId: primaryPropertyId },
            businessDate: { gte: auditedStartDate, lte: auditedEndDate },
            type: 'CHARGE',
            voidedAt: { not: null },
          },
          select: { amount: true },
        }),
      ]);

      for (const item of chargeItems) {
        const amt = Number(item.amount);
        if (item.type === 'CHARGE') {
          if (item.source === 'ROOM_CHARGE') audited.roomRevenue += amt;
          else if (['POS', 'RESTAURANT', 'BAR'].includes(item.source)) audited.fbRevenue += amt;
          else audited.otherRevenue += amt;
        } else if (item.type === 'DISCOUNT') {
          audited.discounts += Math.abs(amt);
        } else if (item.type === 'REFUND') {
          audited.refunds += Math.abs(amt);
        }
      }

      const auditedVoids = voidedItems.reduce((s: number, i: any) => s + Number(i.amount), 0);
      audited.revenue = audited.roomRevenue + audited.fbRevenue + audited.otherRevenue;
      audited.netRevenue = audited.revenue - audited.discounts - audited.refunds;
    }

    // ── 3. Live Since Last Audit (Unaudited Activity) ──────────────────────
    const livePosItems = await prisma.folioItem.findMany({
      where: {
        folio: { propertyId: primaryPropertyId },
        businessDate: liveBusinessDateFilter,
        type: 'CHARGE',
        source: { in: ['POS', 'RESTAURANT', 'BAR'] },
        voidedAt: null,
      },
      select: { amount: true },
    });
    const livePosSales = livePosItems.reduce((s: number, i: any) => s + Number(i.amount), 0);

    const stayovers = await prisma.reservation.findMany({
      where: { propertyId: primaryPropertyId, status: 'CHECKED_IN', checkOut: { gt: liveBusinessDateStart } },
      include: { reservationRooms: { where: { status: 'ACTIVE' } } },
    });
    let liveRoomCharges = 0;
    for (const res of stayovers) {
      const rr = res.reservationRooms[0];
      if (!rr) continue;
      const rate = Number(rr.rateAmount || 0);
      let discount = 0;
      if (rr.discountType === 'FIXED_AMOUNT') discount = Number(rr.discountAmount || 0);
      else if (rr.discountType === 'PERCENTAGE') discount = rate * (Number(rr.discountPercent || 0) / 100);
      liveRoomCharges += Math.max(0, rate - discount);
    }

    const livePayments = await prisma.payment.findMany({
      where: {
        propertyId: primaryPropertyId,
        status: 'COMPLETED',
        createdAt: { gte: startOfDay(now), lte: calendarEndDate }, // Today's live payments
      },
      select: { amount: true },
    });
    const liveCollections = livePayments.reduce((s: number, p: any) => s + Number(p.amount), 0);

    const liveSinceLastAudit = {
      revenueActivity: liveRoomCharges + livePosSales,
      roomCharges: liveRoomCharges,
      posSales: livePosSales,
      collections: liveCollections,
    };

    // ── 4. Cash Control (Variance reporting) ───────────────────────────────
    const fdSessions = await prisma.frontdeskSession.findMany({
      where: { propertyId: primaryPropertyId, businessDate: { gte: sessionStartDate } },
      include: { staff: { select: { firstName: true, lastName: true } } },
    });
    
    const posSessions = await prisma.posSession.findMany({
      where: { outlet: { propertyId: primaryPropertyId }, businessDate: { gte: sessionStartDate } },
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
        businessDate: s.businessDate.toISOString().split('T')[0],
      })),
      ...posSessions.map(s => ({
        label: s.outlet.name,
        expected: Number(s.expectedCash),
        declared: s.actualCash !== null ? Number(s.actualCash) : null,
        variance: s.variance !== null ? Number(s.variance) : null,
        status: toStatus(s.variance !== null ? Number(s.variance) : null),
        businessDate: s.businessDate.toISOString().split('T')[0],
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
    let controlStartDate = period === 'TODAY' ? liveBusinessDateStart : sessionStartDate; // Use business date logic

    const [discountAgg, voidedItemsControl, refundAgg, overrideCount] = await Promise.all([
      prisma.folioItem.aggregate({
        where: { folio: { propertyId: primaryPropertyId }, type: 'DISCOUNT', voidedAt: null, businessDate: { gte: controlStartDate } },
        _sum: { amount: true },
      }),
      prisma.folioItem.findMany({
        where: { folio: { propertyId: primaryPropertyId }, type: 'CHARGE', voidedAt: { gte: calendarStartDate, lte: calendarEndDate } }, // Voids happen in real-time
        select: { amount: true },
      }),
      prisma.folioItem.aggregate({
        where: { folio: { propertyId: primaryPropertyId }, type: 'REFUND', voidedAt: null, businessDate: { gte: controlStartDate } },
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
      select: { balance: true },
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
    const todayVariances = allSessions.filter(s => s.businessDate === businessDate.toISOString().split('T')[0] && s.variance !== null && s.variance < 0);
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
        where: { credit: { propertyId: primaryPropertyId }, businessDate: { gte: controlStartDate } },
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
      businessDate: businessDate.toISOString().split('T')[0],
      lastAuditedBusinessDate: auditedBusinessDate ? auditedBusinessDate.toISOString().split('T')[0] : null,
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
