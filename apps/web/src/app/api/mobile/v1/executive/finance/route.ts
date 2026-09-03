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

    let startDate = startOfDay(businessDate);
    const endDate = endOfDay(businessDate);

    if (period === 'MTD') {
      startDate = startOfMonth(businessDate);
    } else if (period === 'YTD') {
      startDate = startOfYear(businessDate);
    }

    // ── 1. Night Audit Status ───────────────────────────────────────────────
    const lastAudit = await prisma.nightAudit.findFirst({
      where: { propertyId: primaryPropertyId, status: 'COMPLETED' },
      orderBy: { businessDate: 'desc' },
      select: { businessDate: true, completedAt: true, totalRevenue: true, totalRoomRevenue: true },
    });

    const auditStatus: 'AUDITED' | 'PENDING_AUDIT' = lastAudit ? 'AUDITED' : 'PENDING_AUDIT';
    const auditedBusinessDate = lastAudit?.businessDate ?? null;

    let auditedStartDate = auditedBusinessDate ? startOfDay(auditedBusinessDate) : null;
    const auditedEndDate = auditedBusinessDate ? endOfDay(auditedBusinessDate) : null;

    if (auditedBusinessDate) {
      if (period === 'MTD') {
        auditedStartDate = startOfMonth(auditedBusinessDate);
      } else if (period === 'YTD') {
        auditedStartDate = startOfYear(auditedBusinessDate);
      }
    }

    // ── 2. Audited Revenue Breakdown ────────────────────────────────────────
    let auditedRevenue = {
      total: 0, room: 0, fb: 0, bar: 0, other: 0,
      discounts: 0, refunds: 0, voids: 0, net: 0,
      businessDate: '',
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
          if (item.source === 'ROOM_CHARGE') auditedRevenue.room += amt;
          else if (['POS', 'RESTAURANT'].includes(item.source)) auditedRevenue.fb += amt;
          else if (item.source === 'BAR') auditedRevenue.bar += amt;
          else auditedRevenue.other += amt;
        } else if (item.type === 'DISCOUNT') {
          auditedRevenue.discounts += Math.abs(amt);
        } else if (item.type === 'REFUND') {
          auditedRevenue.refunds += Math.abs(amt);
        }
      }

      auditedRevenue.voids = voidedItems.reduce((s: number, i: any) => s + Number(i.amount), 0);
      auditedRevenue.total = auditedRevenue.room + auditedRevenue.fb + auditedRevenue.bar + auditedRevenue.other;
      auditedRevenue.net = auditedRevenue.total - auditedRevenue.discounts - auditedRevenue.refunds;
      auditedRevenue.businessDate = period === 'TODAY' 
        ? auditedBusinessDate.toISOString().split('T')[0]
        : auditedStartDate.toISOString().split('T')[0] + ' to ' + auditedEndDate.toISOString().split('T')[0];
    }

    // ── 3. Live Activity (unaudited, for the selected period) ──────────────
    const livePosItems = await prisma.folioItem.findMany({
      where: {
        folio: { propertyId: primaryPropertyId },
        businessDate: { gte: startDate, lte: endDate },
        type: 'CHARGE',
        source: { in: ['POS', 'RESTAURANT', 'BAR'] },
        voidedAt: null,
      },
      select: { amount: true },
    });
    const posSales = livePosItems.reduce((s: number, i: any) => s + Number(i.amount), 0);

    const stayovers = await prisma.reservation.findMany({
      where: { propertyId: primaryPropertyId, status: 'CHECKED_IN', checkOut: { gt: startDate } }, // CheckOut strictly after startDate to count
      include: { reservationRooms: { where: { status: 'ACTIVE' } } },
    });
    let roomCharges = 0;
    // Note: Live MTD/YTD room charges calculation is complex without actual posted folios. 
    // We will estimate based on the current stayovers for now, since this is "live unaudited". 
    // This will mostly reflect tonight's expected room charges.
    for (const res of stayovers) {
      const rr = res.reservationRooms[0];
      if (!rr) continue;
      const rate = Number(rr.rateAmount || 0);
      let discount = 0;
      if (rr.discountType === 'FIXED_AMOUNT') discount = Number(rr.discountAmount || 0);
      else if (rr.discountType === 'PERCENTAGE') discount = rate * (Number(rr.discountPercent || 0) / 100);
      roomCharges += Math.max(0, rate - discount);
    }

    const liveToday = { total: roomCharges + posSales, roomCharges, posSales };

    // ── 4. Revenue Trend (audited NightAudit records only) ─────────────────
    const now = new Date();
    const mtdStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMtdStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMtdEnd = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    const [auditHistory, mtdAgg, prevMtdAgg] = await Promise.all([
      prisma.nightAudit.findMany({
        where: { propertyId: primaryPropertyId, status: 'COMPLETED' },
        orderBy: { businessDate: 'desc' },
        take: 7,
        select: { businessDate: true, totalRevenue: true },
      }),
      prisma.nightAudit.aggregate({
        where: { propertyId: primaryPropertyId, status: 'COMPLETED', businessDate: { gte: mtdStart } },
        _sum: { totalRevenue: true },
      }),
      prisma.nightAudit.aggregate({
        where: { propertyId: primaryPropertyId, status: 'COMPLETED', businessDate: { gte: prevMtdStart, lte: prevMtdEnd } },
        _sum: { totalRevenue: true },
      }),
    ]);

    const trendDays = [...auditHistory]
      .reverse()
      .map(a => ({ businessDate: a.businessDate.toISOString().split('T')[0], revenue: Number(a.totalRevenue) }));

    const mtdTotal = Number(mtdAgg._sum.totalRevenue || 0);
    const prevMtdTotal = Number(prevMtdAgg._sum.totalRevenue || 0);
    const mtdChangePercent = prevMtdTotal > 0
      ? Number((((mtdTotal - prevMtdTotal) / prevMtdTotal) * 100).toFixed(1))
      : 0;

    // ── 5. Revenue Mix ─────────────────────────────────────────────────────
    const totalAudited = auditedRevenue.room + auditedRevenue.fb + auditedRevenue.bar + auditedRevenue.other;
    const revenueMix = totalAudited > 0
      ? {
          rooms: Number(((auditedRevenue.room / totalAudited) * 100).toFixed(1)),
          fb: Number(((auditedRevenue.fb / totalAudited) * 100).toFixed(1)),
          bar: Number(((auditedRevenue.bar / totalAudited) * 100).toFixed(1)),
          other: Number(((auditedRevenue.other / totalAudited) * 100).toFixed(1)),
        }
      : { rooms: 0, fb: 0, bar: 0, other: 0 };

    // ── 6. Collections (payments received in period) ───────────────────────
    const payments = await prisma.payment.findMany({
      where: {
        propertyId: primaryPropertyId,
        status: 'COMPLETED',
        createdAt: { gte: startDate, lte: endDate },
      },
      select: { amount: true, method: true },
    });
    const collectionsByMethod: Record<string, number> = {};
    let collectionsTotal = 0;
    for (const p of payments) {
      const amt = Number(p.amount);
      collectionsByMethod[p.method] = (collectionsByMethod[p.method] || 0) + amt;
      collectionsTotal += amt;
    }

    // ── 7. Outstanding Receivables (globally active) ───────────────────────
    const openFolios = await prisma.folio.findMany({
      where: { propertyId: primaryPropertyId, status: 'OPEN', balance: { gt: 0 } },
      select: { balance: true, reservation: { select: { corporateAccountId: true } } },
    });
    let guestBalances = 0;
    let corporateReceivables = 0;
    for (const f of openFolios) {
      const bal = Number(f.balance);
      if (f.reservation?.corporateAccountId) corporateReceivables += bal;
      else guestBalances += bal;
    }

    // ── 8. Cash Control ────────────────────────────────────────────────────
    const fdSessions = await prisma.frontdeskSession.findMany({
      where: { propertyId: primaryPropertyId, businessDate: { gte: startDate, lte: endDate } },
      include: { staff: { select: { firstName: true, lastName: true } } },
    });
    
    const posSessions = await prisma.posSession.findMany({
      where: { outlet: { propertyId: primaryPropertyId }, businessDate: { gte: startDate, lte: endDate } },
      include: { outlet: { select: { name: true } } },
    });

    const toStatus = (v: number | null) =>
      v === null ? 'OPEN' : v === 0 ? 'OK' : v < 0 ? 'VARIANCE' : 'OVERAGE';

    const cashSessions = [
      ...fdSessions.map(s => ({
        label: `FD – ${s.staff.firstName} ${s.staff.lastName}`,
        type: 'FRONT_DESK',
        expected: Number(s.systemExpectedCash),
        declared: s.declaredCash !== null ? Number(s.declaredCash) : null,
        variance: s.variance !== null ? Number(s.variance) : null,
        status: toStatus(s.variance !== null ? Number(s.variance) : null),
        businessDate: s.businessDate.toISOString().split('T')[0],
      })),
      ...posSessions.map(s => ({
        label: s.outlet.name,
        type: 'POS',
        expected: Number(s.expectedCash),
        declared: s.actualCash !== null ? Number(s.actualCash) : null,
        variance: s.variance !== null ? Number(s.variance) : null,
        status: toStatus(s.variance !== null ? Number(s.variance) : null),
        businessDate: s.businessDate.toISOString().split('T')[0],
      })),
    ];
    
    // Sort by most recent for MTD/YTD
    cashSessions.sort((a, b) => b.businessDate.localeCompare(a.businessDate));

    // Limit to 25 to prevent extremely long lists on MTD/YTD, or return all
    // Since this is an executive view, we'll return all but they can be optimized later
    
    const cashControl = {
      totalExpected: cashSessions.reduce((s: number, c: any) => s + c.expected, 0),
      totalDeclared: cashSessions.reduce((s: number, c: any) => s + (c.declared ?? 0), 0),
      totalVariance: cashSessions.reduce((s: number, c: any) => s + (c.variance ?? 0), 0),
      sessions: cashSessions,
    };

    // ── 9. Transaction Controls ────────────────────────────────────────────
    const [discountAgg, voidedItems, refundAgg, overrideCount, prevDiscountAgg] = await Promise.all([
      prisma.folioItem.aggregate({
        where: { folio: { propertyId: primaryPropertyId }, type: 'DISCOUNT', voidedAt: null, businessDate: { gte: startDate, lte: endDate } },
        _sum: { amount: true }, _count: { id: true },
      }),
      prisma.folioItem.findMany({
        where: { folio: { propertyId: primaryPropertyId }, type: 'CHARGE', voidedAt: { gte: startDate, lte: endDate } },
        select: { amount: true },
      }),
      prisma.folioItem.aggregate({
        where: { folio: { propertyId: primaryPropertyId }, type: 'REFUND', voidedAt: null, businessDate: { gte: startDate, lte: endDate } },
        _sum: { amount: true }, _count: { id: true },
      }),
      prisma.approvalRequest.count({
        where: { propertyId: primaryPropertyId, createdAt: { gte: startDate, lte: endDate } },
      }),
      auditedBusinessDate
        ? prisma.folioItem.aggregate({
            // Using the single auditedBusinessDate for trend comparison, 
            // but if period is MTD, this comparison isn't extremely useful. 
            // We'll leave it as comparing to the last audited day for simplicity.
            where: { folio: { propertyId: primaryPropertyId }, type: 'DISCOUNT', voidedAt: null, businessDate: { gte: startOfDay(auditedBusinessDate), lte: endOfDay(auditedBusinessDate) } },
            _sum: { amount: true },
          })
        : Promise.resolve({ _sum: { amount: null } }),
    ]);

    const discountTotal = Math.abs(Number(discountAgg._sum.amount || 0));
    const prevDiscountTotal = Math.abs(Number(prevDiscountAgg._sum.amount || 0));
    const discountChangePercent = prevDiscountTotal > 0
      ? Number((((discountTotal - prevDiscountTotal) / prevDiscountTotal) * 100).toFixed(1))
      : 0;

    const transactionControls = {
      discounts: { total: discountTotal, count: discountAgg._count.id, changePercent: discountChangePercent },
      voids: { total: voidedItems.reduce((s: number, i: any) => s + Number(i.amount), 0), count: voidedItems.length },
      refunds: { total: Math.abs(Number(refundAgg._sum.amount || 0)), count: refundAgg._count.id },
      overrides: { count: overrideCount },
    };

    // ── 10. Guest Credits (globally active for the most part) ──────────────
    const [availableAgg, consumedAgg, allAgg] = await Promise.all([
      prisma.folioCredit.aggregate({
        where: { propertyId: primaryPropertyId, status: { in: ['AVAILABLE', 'PARTIALLY_APPLIED'] } },
        _sum: { remainingAmount: true },
      }),
      prisma.folioCreditApplication.aggregate({
        where: { credit: { propertyId: primaryPropertyId }, businessDate: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
      prisma.folioCredit.aggregate({
        where: { propertyId: primaryPropertyId, status: { not: 'REFUNDED' }, createdAt: { gte: startDate, lte: endDate } },
        _sum: { amount: true },
      }),
    ]);

    const guestCredits = {
      depositsHeld: Number(allAgg._sum.amount || 0), // Deposits taken in this period
      creditsAvailable: Number(availableAgg._sum.remainingAmount || 0), // Total currently available
      creditsConsumed: Number(consumedAgg._sum.amount || 0), // Credits used in this period
    };

    // ── 11. Financial Alerts (always global/current state) ─────────────────
    const attention: Array<{ id: string; priority: string; category: string; title: string; summary: string; affectedCount: number; totalAmount: number }> = [];
    const settings = (property.settings as Record<string, any>) || {};
    const highBalThreshold = settings.financial?.highBalanceThreshold || 150000;

    const highBalanceFolios = openFolios.filter((f: any) => Number(f.balance) > highBalThreshold);
    if (highBalanceFolios.length > 0) {
      attention.push({
        id: 'high-balance', priority: 'P0', category: 'RECEIVABLES',
        title: 'High Guest Balance',
        summary: `${highBalanceFolios.length} accounts exceed ₦${(highBalThreshold / 1000).toFixed(0)}K threshold`,
        affectedCount: highBalanceFolios.length,
        totalAmount: highBalanceFolios.reduce((s: number, f: any) => s + Number(f.balance), 0),
      });
    }

    if (Math.abs(cashControl.totalVariance) > 5000) {
      const variantSessions = cashSessions.filter((s: any) => s.variance !== null && s.variance < 0);
      attention.push({
        id: 'cash-variance', priority: 'P0', category: 'CASH CONTROL',
        title: 'Cashier Variance Detected',
        summary: 'Cash declared does not match system expected',
        affectedCount: variantSessions.length,
        totalAmount: Math.abs(cashControl.totalVariance),
      });
    }

    if (discountChangePercent > 20) {
      attention.push({
        id: 'discount-spike', priority: 'P1', category: 'TRANSACTION CONTROLS',
        title: 'Discount Spike',
        summary: `Discounts up ${discountChangePercent}% vs previous audit day`,
        affectedCount: discountAgg._count.id,
        totalAmount: discountTotal,
      });
    }

    const pendingRefunds = await prisma.refund.findMany({
      where: { propertyId: primaryPropertyId, status: 'PENDING' },
      select: { amount: true },
    });
    if (pendingRefunds.length > 0) {
      attention.push({
        id: 'pending-refunds', priority: 'P1', category: 'FINANCE',
        title: 'Refunds Awaiting Approval',
        summary: `${pendingRefunds.length} refund(s) pending review`,
        affectedCount: pendingRefunds.length,
        totalAmount: pendingRefunds.reduce((s: number, r: any) => s + Number(r.amount), 0),
      });
    }

    const outstandingTotal = guestBalances + corporateReceivables;
    if (outstandingTotal > 1_000_000) {
      attention.push({
        id: 'outstanding-receivables', priority: 'P1', category: 'RECEIVABLES',
        title: 'Outstanding Receivables',
        summary: `₦${(outstandingTotal / 1_000_000).toFixed(2)}M in open folio balances`,
        affectedCount: openFolios.length,
        totalAmount: outstandingTotal,
      });
    }

    // ── Response ───────────────────────────────────────────────────────────
    return successResponse({
      property: { id: property.id, name: property.name, currency: property.baseCurrency || 'NGN', timezone: property.timezone },
      businessDate: businessDate.toISOString().split('T')[0],
      generatedAt: new Date().toISOString(),

      auditStatus,
      lastAudit: lastAudit
        ? { businessDate: lastAudit.businessDate.toISOString().split('T')[0], completedAt: lastAudit.completedAt?.toISOString() ?? null, totalRevenue: Number(lastAudit.totalRevenue) }
        : null,

      auditedRevenue,
      liveToday,

      trend: { period: '7D', days: trendDays, mtdTotal, mtdChangePercent },
      revenueMix,
      collections: { total: collectionsTotal, byMethod: Object.entries(collectionsByMethod).map(([method, amount]) => ({ method, amount })) },
      outstanding: { total: outstandingTotal, guestBalances, corporateReceivables, other: 0 },
      cashControl,
      transactionControls,
      guestCredits,
      attention,
    }, 200);
  } catch (err: any) {
    console.error('[Mobile Executive Finance API]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating executive finance dashboard', 500);
  }
}
