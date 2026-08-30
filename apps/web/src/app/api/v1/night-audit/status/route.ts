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

    const userRole = (session.user as any).role;
    const ALLOWED_ROLES = ['NIGHT_AUDITOR', 'MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'CEO', 'FINANCE_MANAGER', 'GENERAL_CASHIER', 'FRONT_DESK_SUPERVISOR'];
    if (!ALLOWED_ROLES.includes(userRole)) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions to view night audit status', 403);
    }

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    await assertPropertyAccess(session.user.id, propertyId);

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true, businessDate: true, timezone: true, auditStatus: true, lastAuditAt: true, baseCurrency: true, requireAuditAcknowledgements: true }
    });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    const businessDate = property.businessDate ?? getPropertyBusinessDate();
    const localToday = getPropertyBusinessDate(property.timezone);
    const [currentAudit, activeAudit] = await Promise.all([
      prisma.nightAudit.findUnique({ 
        where: { propertyId_businessDate: { propertyId, businessDate } },
        include: { acknowledgements: true }
      }),
      prisma.nightAudit.findFirst({
        where: { propertyId, status: { in: ['IN_PROGRESS', 'POSTING'] } },
        orderBy: { startedAt: 'desc' }
      })
    ]);

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

    // Financial blockers/warnings
    if (financial.highBalances.length > 0) warnings++;
    
    // Cash blockers/warnings
    if (cash.cashHandovers.length > 0) blockers++;
    if (cash.unverifiedTransactions.length > 0) blockers++;
    if (cash.bankDeposits.length > 0) warnings++;
    
    // Single canonical state field — the UI should branch exclusively on this.
    type AuditState = 'IN_PROGRESS' | 'POSTING' | 'COMPLETED' | 'FAILED' | 'OVERDUE' | 'PENDING';
    const auditState: AuditState =
      activeAudit?.status === 'IN_PROGRESS' ? 'IN_PROGRESS' :
      activeAudit?.status === 'POSTING'     ? 'POSTING' :
      currentAudit?.status === 'COMPLETED'  ? 'COMPLETED' :
      currentAudit?.status === 'FAILED'     ? 'FAILED' :
      businessDate < localToday             ? 'OVERDUE' :
                                              'PENDING';

    return successResponse({
      property,
      businessDate,
      currentAudit,
      activeAudit,
      // auditState is the single canonical status field. Use this in the UI.
      auditState,
      // Legacy fields kept for backwards compatibility:
      auditPhase: activeAudit?.status || (currentAudit?.status ?? 'PENDING'),
      auditInProgress: Boolean(activeAudit),
      auditDue: !activeAudit && (property.auditStatus === 'FAILED' || businessDate < localToday),
      isBusinessDayAudited: !activeAudit && property.auditStatus !== 'FAILED' && businessDate >= localToday,
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
