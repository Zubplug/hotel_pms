import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { assertPropertyAccess } from '@/lib/property-access';
import prisma from '@hotel-pms/db';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import { getOperationalReview, getSystemIntegrity, getFinancialAudit, getCashReconciliation } from '@/lib/night-audit-service';
import { activeOccupancyWhere, reconcileRoomOccupancy } from '@/lib/room-occupancy';

export async function GET(req: NextRequest) {
  try {
    let user: any = null;
    const session = await auth();
    if (session?.user) {
      user = session.user;
    } else {
      user = await resolveUser(req);
    }
    
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const userRole = user.role;
    const ALLOWED_ROLES = ['NIGHT_AUDITOR', 'ACCOUNTANT', 'MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'CEO', 'FINANCE_MANAGER', 'GENERAL_CASHIER', 'FRONT_DESK_SUPERVISOR'];
    if (!ALLOWED_ROLES.includes(userRole)) {
      return errorResponse('FORBIDDEN', 'Insufficient permissions to view night audit status', 403);
    }

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    if (!(await requireOrganizationContext(user.id)).propertyIds.includes(propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true, businessDate: true, timezone: true, auditStatus: true, lastAuditAt: true, baseCurrency: true, requireAuditAcknowledgements: true }
    });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    const businessDate = property.businessDate ?? getPropertyBusinessDate(property.timezone);
    // Normalise to a plain YYYY-MM-DD string so the mobile client always receives
    // a predictable format regardless of whether Prisma returned a Date or string.
    const bDate: any = businessDate;
    const businessDateStr = bDate instanceof Date
      ? bDate.toISOString().slice(0, 10)
      : (typeof bDate === 'string' ? bDate.slice(0, 10) : String(bDate).slice(0, 10));
    const localToday = getPropertyBusinessDate(property.timezone);
    await reconcileRoomOccupancy(propertyId, businessDate);
    const [currentAudit, activeAudit, lastCompletedAudit] = await Promise.all([
      prisma.nightAudit.findUnique({ 
        where: { propertyId_businessDate: { propertyId, businessDate } },
        include: {
          acknowledgements: true,
          closePackage: true,
          journalEntries: { where: { status: 'POSTED' }, select: { id: true } },
        }
      }),
      prisma.nightAudit.findFirst({
        where: { propertyId, status: { in: ['IN_PROGRESS', 'POSTING'] } },
        orderBy: { startedAt: 'desc' }
      }),
      prisma.nightAudit.findFirst({
        where: { propertyId, status: 'COMPLETED' },
        orderBy: [{ businessDate: 'desc' }, { completedAt: 'desc' }],
      }),
    ]);

    const auditStaffIds = [currentAudit?.runBy, activeAudit?.runBy, lastCompletedAudit?.runBy].filter((id): id is string => Boolean(id));
    const auditStaff = auditStaffIds.length
      ? await prisma.staff.findMany({
          where: { id: { in: auditStaffIds } },
          select: { id: true, firstName: true, lastName: true, position: true },
        })
      : [];
    const auditStaffMap = new Map(auditStaff.map((staff) => [staff.id, staff]));
    const withAuditOwner = (audit: any) => audit ? {
      ...audit,
      runByStaff: audit.runBy ? auditStaffMap.get(audit.runBy) || null : null,
    } : audit;

    // Run all checks in parallel for maximum performance
    const [operational, system, financial, cash] = await Promise.all([
      getOperationalReview(await requireOrganizationContext(user.id), propertyId),
      getSystemIntegrity(await requireOrganizationContext(user.id), propertyId),
      getFinancialAudit(await requireOrganizationContext(user.id), propertyId),
      getCashReconciliation(await requireOrganizationContext(user.id), propertyId)
    ]);

    const trendStart = new Date(businessDate);
    trendStart.setUTCDate(trendStart.getUTCDate() - 6);
    const [rooms, inHouseGuests, charges, payments, latePostings, sessions, trend, activityFeed, financialSnapshot, journalTotals, accountingPeriod, transactionExceptions, refundTotals, folioActivity] = await Promise.all([
      prisma.room.findMany({ where: { propertyId, isActive: true }, select: { status: true } }),
      prisma.reservation.count({
        where: {
          propertyId,
          status: 'CHECKED_IN',
          reservationRooms: { some: activeOccupancyWhere(propertyId) },
        }
      }),
      prisma.folioItem.aggregate({ where: { folio: { propertyId }, businessDate, type: 'CHARGE', voidedAt: null }, _sum: { amount: true } }),
      prisma.folioItem.aggregate({ where: { folio: { propertyId }, businessDate, type: { in: ['PAYMENT', 'REFUND'] }, voidedAt: null }, _sum: { amount: true } }),
      prisma.folioItem.count({ where: { folio: { propertyId }, businessDate, isLatePosting: true, voidedAt: null } }),
      prisma.posSession.aggregate({ where: { propertyId, businessDate }, _sum: { variance: true } }),
      prisma.nightAudit.findMany({ 
        where: { propertyId, status: 'COMPLETED', businessDate: { gte: trendStart, lte: businessDate } }, 
        orderBy: { businessDate: 'asc' }, 
        take: 7, 
        select: { 
          id: true,
          businessDate: true, 
          totalRevenue: true, 
          occupancy: true, 
          adr: true, 
          revpar: true,
          financialSnapshot: true 
        } 
      }),
      prisma.hotelActivityEvent.findMany({ where: { propertyId, businessDate: bDate instanceof Date ? bDate : new Date(businessDate) }, orderBy: { occurredAt: 'desc' }, take: 100 }),
      currentAudit ? prisma.nightAuditFinancialSnapshot.findUnique({ where: { nightAuditId: currentAudit.id } }) : Promise.resolve(null),
      prisma.journalEntry.aggregate({
        where: { propertyId, ...(currentAudit ? { nightAuditId: currentAudit.id } : { entryDate: businessDate }), status: 'POSTED' },
        _sum: { totalDebit: true, totalCredit: true },
        _count: { id: true },
      }),
      prisma.accountingPeriod.findFirst({
        where: { propertyId, periodStart: { lte: businessDate }, periodEnd: { gte: businessDate } },
        select: { id: true, name: true, status: true, periodStart: true, periodEnd: true },
      }),
      prisma.transactionException.count({
        where: { propertyId, businessDate, status: { in: ['OPEN', 'PENDING_APPROVAL'] } },
      }),
      prisma.refund.aggregate({
        where: { propertyId, businessDate, status: 'COMPLETED' },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.folioItem.groupBy({
        by: ['type'],
        where: { folio: { propertyId }, businessDate, voidedAt: null },
        _sum: { amount: true },
        _count: { id: true },
      })
    ]);

    const roomAnalysis = rooms.reduce((result: Record<string, number>, room) => {
      result[room.status] = (result[room.status] || 0) + 1;
      return result;
    }, {});

    // Rebuild room revenue from the posting source so legacy room charges
    // incorrectly stored with revenueCategory=OTHER still render as Rooms.
    const trendAuditIds = trend.map((audit) => audit.id).filter(Boolean);
    const roomRevenueByAudit = trendAuditIds.length > 0
      ? await prisma.folioItem.groupBy({
          by: ['nightAuditRunId'],
          where: {
            folio: { propertyId },
            nightAuditRunId: { in: trendAuditIds },
            type: 'CHARGE',
            source: 'ROOM_CHARGE',
            voidedAt: null,
          },
          _sum: { amount: true },
        })
      : [];
    const roomRevenueMap = new Map(roomRevenueByAudit.map((row) => [row.nightAuditRunId, Number(row._sum.amount || 0)]));
    const normalizedTrend = trend.map((audit) => {
      const sourceRoomRevenue = roomRevenueMap.get(audit.id);
      if (sourceRoomRevenue === undefined) return audit;
      return {
        ...audit,
        financialSnapshot: audit.financialSnapshot
          ? { ...audit.financialSnapshot, roomRevenue: sourceRoomRevenue }
          : audit.financialSnapshot,
      };
    });

    const snapshotTotals = financialSnapshot ? {
      roomRevenue: Number(financialSnapshot.roomRevenue || 0),
      fnbRevenue: Number(financialSnapshot.fnbRevenue || 0),
      otherRevenue: Number(financialSnapshot.otherRevenue || 0),
      taxes: Number(financialSnapshot.taxes || 0),
      discounts: Number(financialSnapshot.discounts || 0),
      refunds: Number(financialSnapshot.refunds || 0),
      grossRevenue: Number(financialSnapshot.grossRevenue || 0),
      netRevenue: Number(financialSnapshot.netRevenue || 0),
    } : null;
    const ledgerDifference = Number(journalTotals._sum.totalDebit || 0) - Number(journalTotals._sum.totalCredit || 0);
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
    if ((system.openPosOrders?.length ?? 0) > 0) blockers++;

    // Financial blockers/warnings
    if (financial.highBalances.length > 0) warnings++;
    if (financial.pendingDiscounts?.length > 0) warnings++;
    if (financial.unverifiedComplimentary?.length > 0) blockers++;
    if (financial.pendingCheckInBypasses?.length > 0) blockers++;
    
    // Cash blockers/warnings
    if (cash.cashHandovers.length > 0) blockers++;
    if (cash.unverifiedTransactions.length > 0) blockers++;
    if (cash.bankDeposits.length > 0) warnings++;

    const linkedJournalCount = currentAudit?.journalEntries?.length || 0;
    const balanceProofStatus = (currentAudit?.closePackage?.balanceProof as any)?.status || 'INCOMPLETE';
    const balanceProofHasVariance = balanceProofStatus === 'HAS_VARIANCE';
    const balanceProofIncomplete = balanceProofStatus === 'INCOMPLETE';
    const missingLinkedJournal = currentAudit?.status === 'COMPLETED'
      && Number(financialSnapshot?.grossRevenue || 0) > 0
      && linkedJournalCount === 0;
    const closeStatus = activeAudit
      ? 'IN_PROGRESS'
      : currentAudit?.status === 'FAILED'
        ? 'FAILED'
        : currentAudit?.status === 'COMPLETED'
          ? (blockers > 0 || missingLinkedJournal ? 'CANNOT_CLOSE' : balanceProofHasVariance ? 'HAS_VARIANCE' : transactionExceptions > 0 || balanceProofIncomplete ? 'HAS_UNRESOLVED_EXCEPTIONS' : 'COMPLETED')
        : blockers > 0
            ? 'CANNOT_CLOSE'
            : 'READY';
    const insightCandidates = [
      latePostings > 0 ? { severity: 'MEDIUM', title: 'Late postings detected', detail: `${latePostings} folio item${latePostings === 1 ? '' : 's'} were posted late for this business date.`, metric: latePostings } : null,
      transactionExceptions > 0 ? { severity: 'HIGH', title: 'Financial exceptions remain open', detail: `${transactionExceptions} payment exception${transactionExceptions === 1 ? '' : 's'} require review before close.`, metric: transactionExceptions } : null,
      Number(sessions._sum.variance || 0) !== 0 ? { severity: 'HIGH', title: 'Cashier variance requires attention', detail: `POS session variance totals ${Number(sessions._sum.variance || 0).toLocaleString()}.`, metric: Number(sessions._sum.variance || 0) } : null,
      missingLinkedJournal ? { severity: 'HIGH', title: 'Night Audit journal package is incomplete', detail: 'Revenue was closed, but no posted journal is linked directly to this audit run for drill-down traceability.', metric: 0 } : null,
      balanceProofHasVariance ? { severity: 'HIGH', title: 'Balance proof has variance', detail: 'One or more dated subledger balances do not agree with the expected closing balance.', metric: 0 } : null,
      snapshotTotals && snapshotTotals.grossRevenue > 0 && snapshotTotals.fnbRevenue === 0 ? { severity: 'MEDIUM', title: 'No F&B revenue captured', detail: 'The completed snapshot contains no F&B/POS revenue for this date.', metric: 0 } : null,
    ].filter(Boolean);
    
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
      businessDate: businessDateStr,
      currentAudit: withAuditOwner(currentAudit),
      activeAudit: withAuditOwner(activeAudit),
      lastCompletedAudit: withAuditOwner(lastCompletedAudit),
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
        trend: normalizedTrend,
      },
      activityFeed,
      financialSnapshot,
      accounting: {
        period: accountingPeriod,
        journal: {
          postedEntryCount: journalTotals._count.id,
          debit: Number(journalTotals._sum.totalDebit || 0),
          credit: Number(journalTotals._sum.totalCredit || 0),
          difference: ledgerDifference,
          status: Math.abs(ledgerDifference) < 0.01 ? 'BALANCED' : 'OUT_OF_BALANCE',
        },
        transactionExceptions,
        refunds: { amount: Number(refundTotals._sum.amount || 0), count: refundTotals._count.id },
        folioActivity: folioActivity.map((row) => ({ type: row.type, amount: Number(row._sum.amount || 0), count: row._count.id })),
      },
      closeControl: {
        status: closeStatus,
        snapshot: snapshotTotals,
        hasOpeningClosingBalance: balanceProofStatus === 'PROVEN',
        balanceProofStatus,
        package: currentAudit?.closePackage || null,
        linkedJournalEntryCount: linkedJournalCount,
      },
      insights: insightCandidates,
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
