import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import prisma from '@hotel-pms/db';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import { getOperationalReview, getSystemIntegrity, getFinancialAudit, getCashReconciliation } from '@/lib/night-audit-service';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    await assertPropertyAccess(session.user.id, propertyId);

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true, businessDate: true, auditStatus: true, lastAuditAt: true, baseCurrency: true }
    });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    const businessDate = property.businessDate ?? getPropertyBusinessDate();
    const currentAudit = await prisma.nightAudit.findUnique({ where: { propertyId_businessDate: { propertyId, businessDate } } });

    // Run all checks in parallel for maximum performance
    const [operational, system, financial, cash] = await Promise.all([
      getOperationalReview(propertyId),
      getSystemIntegrity(propertyId),
      getFinancialAudit(propertyId),
      getCashReconciliation(propertyId)
    ]);

    const trendStart = new Date(businessDate);
    trendStart.setUTCDate(trendStart.getUTCDate() - 6);
    const [rooms, inHouseGuests, charges, payments, latePostings, sessions, trend] = await Promise.all([
      prisma.room.findMany({ where: { propertyId, isActive: true }, select: { status: true } }),
      prisma.reservation.count({ where: { propertyId, status: 'CHECKED_IN' } }),
      prisma.folioItem.aggregate({ where: { folio: { propertyId }, businessDate, type: 'CHARGE', voidedAt: null }, _sum: { amount: true } }),
      prisma.folioItem.aggregate({ where: { folio: { propertyId }, businessDate, type: { in: ['PAYMENT', 'REFUND'] }, voidedAt: null }, _sum: { amount: true } }),
      prisma.folioItem.count({ where: { folio: { propertyId }, businessDate, isLatePosting: true, voidedAt: null } }),
      prisma.posSession.aggregate({ where: { propertyId, businessDate }, _sum: { variance: true } }),
      prisma.nightAudit.findMany({ where: { propertyId, status: 'COMPLETED', businessDate: { gte: trendStart, lte: businessDate } }, orderBy: { businessDate: 'asc' }, take: 7, select: { businessDate: true, totalRevenue: true, occupancy: true, adr: true, revpar: true } })
    ]);

    const roomAnalysis = rooms.reduce((result: Record<string, number>, room) => {
      result[room.status] = (result[room.status] || 0) + 1;
      return result;
    }, {});

    // Calculate readiness score
    let blockers = 0;
    let warnings = 0;

    // Operational blockers/warnings
    if (operational.arrivals.length > 0) warnings++;
    if (operational.departures.length > 0) warnings++;
    if (operational.roomReconciliation.some(r => r.issue)) warnings++;

    // System blockers/warnings
    if (system.openPosSessions.length > 0) blockers++;
    if (system.openFrontdeskSessions.length > 0) blockers++;
    if (system.financialSyncConflicts.length > 0) blockers++;
    if (system.hardwareAgents.some(a => a.status === 'OFFLINE')) warnings++;

    // Financial blockers/warnings
    if (financial.highBalances.length > 0) warnings++;
    // Unposted transactions missing here - mock check for now
    
    // Cash blockers/warnings
    // Checking variances in UI
    
    return successResponse({
      property,
      businessDate,
      currentAudit,
      isBusinessDayAudited: currentAudit?.status === 'COMPLETED',
      analytics: {
        revenue: Number(charges._sum.amount || 0),
        payments: Number(payments._sum.amount || 0),
        cashVariance: Number(sessions._sum.variance || 0),
        latePostings,
        inHouseGuests,
        rooms: { total: rooms.length, occupied: roomAnalysis.OCCUPIED || 0, available: roomAnalysis.AVAILABLE || 0, outOfOrder: roomAnalysis.OUT_OF_ORDER || 0 },
        trend,
      },
      operational,
      system,
      financial,
      cash,
      summary: { blockers, warnings }
    });

  } catch (err: any) {
    if (err.message && err.message.includes(':')) {
      const [code, msg] = err.message.split(':');
      const statusCode = code === 'NOT_FOUND' ? 404 : (code === 'FORBIDDEN' ? 403 : 409);
      return errorResponse(code, msg, statusCode);
    }
    console.error('[Night Audit Status GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
