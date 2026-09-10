import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import {
  getExecutiveKPISnapshot,
  getExecutiveRevenueTrend,
  getPropertyBusinessDate,
  getSyncSummary,
} from '@/lib/kpi';

export const dynamic = 'force-dynamic';

const startOfBusinessDay = (date: Date) => new Date(`${date.toISOString().slice(0, 10)}T00:00:00.000Z`);
const endOfBusinessDay = (date: Date) => new Date(`${date.toISOString().slice(0, 10)}T23:59:59.999Z`);

async function buildInventoryAndAuditAnalytics(propertyIds: string[], businessDate: Date) {
  const trendStart = new Date(businessDate);
  trendStart.setUTCDate(trendStart.getUTCDate() - 13);

  const [stockItems, openAlerts, transactions, properties, audits] = await Promise.all([
    prisma.stockItem.findMany({
      where: { propertyId: { in: propertyIds }, isActive: true },
      select: { propertyId: true, quantityOnHand: true, costPrice: true, reorderLevel: true },
    }),
    prisma.inventoryAlert.groupBy({
      by: ['propertyId'],
      where: { propertyId: { in: propertyIds }, status: 'OPEN' },
      _count: { id: true },
    }),
    prisma.stockTransaction.findMany({
      where: { propertyId: { in: propertyIds }, businessDate: { gte: trendStart, lte: endOfBusinessDay(businessDate) } },
      select: { businessDate: true, source: true, totalValue: true },
      orderBy: { businessDate: 'asc' },
    }),
    prisma.property.findMany({
      where: { id: { in: propertyIds } },
      select: { id: true, name: true, auditStatus: true, lastAuditAt: true, businessDate: true },
    }),
    prisma.nightAudit.findMany({
      where: { propertyId: { in: propertyIds }, businessDate: { gte: trendStart, lte: endOfBusinessDay(businessDate) } },
      select: { propertyId: true, businessDate: true, status: true, errors: true, exceptions: true, completedAt: true },
      orderBy: { businessDate: 'desc' },
    }),
  ]);

  const movementMap = new Map<string, { date: string; receipts: number; issues: number; adjustments: number }>();
  for (let offset = 0; offset < 14; offset += 1) {
    const date = new Date(trendStart);
    date.setUTCDate(date.getUTCDate() + offset);
    movementMap.set(date.toISOString().slice(0, 10), { date: date.toISOString().slice(0, 10), receipts: 0, issues: 0, adjustments: 0 });
  }
  for (const transaction of transactions) {
    const day = movementMap.get(new Date(transaction.businessDate).toISOString().slice(0, 10));
    if (!day) continue;
    const value = Math.abs(Number(transaction.totalValue || 0));
    if (transaction.source === 'RECEIPT' || transaction.source === 'RETURN') day.receipts += value;
    else if (transaction.source === 'SALE' || transaction.source === 'TRANSFER' || transaction.source === 'WASTE' || transaction.source === 'POS_VOID' || transaction.source === 'POS_REFUND') day.issues += value;
    else day.adjustments += value;
  }

  const latestByProperty = new Map<string, (typeof audits)[number]>();
  for (const audit of audits) if (!latestByProperty.has(audit.propertyId)) latestByProperty.set(audit.propertyId, audit);
  const latest = properties.map(property => {
    const audit = latestByProperty.get(property.id);
    return {
      propertyId: property.id,
      propertyName: property.name,
      status: audit?.status || property.auditStatus || 'PENDING',
      businessDate: audit?.businessDate?.toISOString() || property.businessDate?.toISOString() || null,
      completedAt: audit?.completedAt?.toISOString() || property.lastAuditAt?.toISOString() || null,
      errors: audit?.errors || 0,
      exceptions: Array.isArray(audit?.exceptions) ? audit?.exceptions.length : 0,
    };
  });

  const completed = latest.filter(item => item.status === 'COMPLETED' || item.status === 'COMPLETED_WITH_EXCEPTIONS').length;
  const failed = latest.filter(item => item.status === 'FAILED').length;
  return {
    inventory: {
      totalValue: stockItems.reduce((sum, item) => sum + Number(item.quantityOnHand) * Number(item.costPrice), 0),
      itemCount: stockItems.length,
      lowStock: stockItems.filter(item => item.reorderLevel !== null && Number(item.quantityOnHand) <= Number(item.reorderLevel)).length,
      openAlerts: openAlerts.reduce((sum, item) => sum + Number((item._count as { id?: number }).id || 0), 0),
      movementValue: transactions.reduce((sum, item) => sum + Math.abs(Number(item.totalValue || 0)), 0),
      trend: Array.from(movementMap.values()),
    },
    audit: { completed, failed, pending: latest.length - completed - failed, latest },
  };
}

async function buildDepartmentAnalytics(propertyIds: string[], businessDate: Date) {
  const [fnbOrders, activeFnbOrders, fnbVoids, safe, pendingHandovers, pendingDeposits, frontdeskSessions, frontdeskPayments, openExceptions] = await Promise.all([
    prisma.posOrder.aggregate({ where: { propertyId: { in: propertyIds }, businessDate, status: { not: 'VOIDED' } }, _sum: { total: true, guestCount: true }, _count: { id: true } }),
    prisma.posOrder.count({ where: { propertyId: { in: propertyIds }, businessDate, status: { in: ['SUBMITTED', 'IN_SERVICE'] } } }),
    prisma.posVoid.count({ where: { order: { propertyId: { in: propertyIds } }, businessDate } }),
    prisma.cashAccount.aggregate({ where: { propertyId: { in: propertyIds }, type: 'SAFE', isActive: true }, _sum: { balance: true } }),
    prisma.cashHandover.aggregate({ where: { propertyId: { in: propertyIds }, status: 'PENDING' }, _sum: { amount: true }, _count: { id: true } }),
    prisma.bankDeposit.aggregate({ where: { propertyId: { in: propertyIds }, status: { in: ['PENDING_HANDOVER', 'HANDED_OVER', 'UNDER_RECONCILIATION', 'EXCEPTION'] } }, _sum: { expectedAmount: true }, _count: { id: true } }),
    prisma.frontdeskSession.groupBy({ by: ['status'], where: { propertyId: { in: propertyIds }, businessDate }, _count: { id: true } }),
    prisma.payment.aggregate({ where: { propertyId: { in: propertyIds }, status: 'COMPLETED', createdAt: { gte: startOfBusinessDay(businessDate), lte: endOfBusinessDay(businessDate) } }, _sum: { amount: true }, _count: { id: true } }),
    prisma.reconciliationException.count({ where: { propertyId: { in: propertyIds }, status: 'OPEN' } }),
  ]);

  const sessionCount = (statuses: string[]) => frontdeskSessions.filter(item => statuses.includes(item.status)).reduce((sum, item) => sum + item._count.id, 0);
  return {
    fnb: { revenue: Number(fnbOrders._sum.total || 0), orders: fnbOrders._count.id, covers: Number(fnbOrders._sum.guestCount || 0), activeOrders: activeFnbOrders, voids: fnbVoids },
    cashier: { safeBalance: Number(safe._sum.balance || 0), pendingHandovers: pendingHandovers._count.id, pendingHandoverValue: Number(pendingHandovers._sum.amount || 0), pendingDeposits: pendingDeposits._count.id, pendingDepositValue: Number(pendingDeposits._sum.expectedAmount || 0) },
    frontdesk: { collections: Number(frontdeskPayments._sum.amount || 0), paymentCount: frontdeskPayments._count.id, openSessions: sessionCount(['OPEN', 'CLOSING']), reviewSessions: sessionCount(['SUBMITTED', 'UNDER_REVIEW', 'HANDOVER_PENDING', 'DEPOSIT_PENDING', 'UNDER_RECONCILIATION']), exceptions: openExceptions },
  };
}

async function buildPropertySnapshot(property: { id: string; name: string; code: string }) {
  const businessDate = await getPropertyBusinessDate(property.id);
  const [kpi, trend, sync, arrivals, departures, activeGuests, receivables, approvals, housekeeping, maintenance] = await Promise.all([
    getExecutiveKPISnapshot(property.id, businessDate),
    getExecutiveRevenueTrend(property.id, businessDate, 14),
    getSyncSummary(property.id),
    prisma.reservation.count({ where: { propertyId: property.id, checkIn: { gte: startOfBusinessDay(businessDate), lte: endOfBusinessDay(businessDate) }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } } }),
    prisma.reservation.count({ where: { propertyId: property.id, checkOut: { gte: startOfBusinessDay(businessDate), lte: endOfBusinessDay(businessDate) }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } } }),
    prisma.reservation.aggregate({
      where: { propertyId: property.id, status: 'CHECKED_IN' },
      _sum: { adults: true, children: true },
    }),
    prisma.folio.aggregate({ where: { propertyId: property.id, balance: { gt: 0 } }, _sum: { balance: true }, _count: { id: true } }),
    prisma.approvalRequest.count({ where: { propertyId: property.id, status: 'PENDING' } }),
    prisma.housekeepingTask.count({ where: { propertyId: property.id, businessDate, status: { notIn: ['INSPECTED', 'CANCELLED'] } } }),
    prisma.maintenanceTicket.count({ where: { propertyId: property.id, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
  ]);

  return {
    id: property.id,
    name: property.name,
    code: property.code,
    businessDate: businessDate.toISOString(),
    kpi,
    trend,
    sync,
    arrivals,
    departures,
    activeGuests: Number(activeGuests._sum.adults || 0) + Number(activeGuests._sum.children || 0),
    receivables: Number(receivables._sum.balance || 0),
    receivablesCount: receivables._count.id,
    pendingApprovals: approvals,
    housekeepingOpen: housekeeping,
    maintenanceOpen: maintenance,
  };
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const ctx = await requireOrganizationContext(session.user.id);
    const requestedPropertyId = req.nextUrl.searchParams.get('propertyId');
    const propertyIds = requestedPropertyId
      ? ctx.propertyIds.includes(requestedPropertyId)
        ? [requestedPropertyId]
        : []
      : ctx.propertyIds;

    if (requestedPropertyId && propertyIds.length === 0) return errorResponse('FORBIDDEN', 'No access to this property', 403);
    if (propertyIds.length === 0) return successResponse({ scope: { propertyId: null, properties: [] }, kpis: null, trend: [], properties: [], activity: [] });

    const properties = await prisma.property.findMany({
      where: { id: { in: [...propertyIds] } },
      select: { id: true, name: true, code: true },
      orderBy: { name: 'asc' },
    });
    const snapshots = await Promise.all(properties.map(buildPropertySnapshot));
    const portfolioBusinessDate = snapshots[0]?.businessDate ? new Date(snapshots[0].businessDate) : new Date();
    const inventoryAndAudit = await buildInventoryAndAuditAnalytics([...propertyIds], portfolioBusinessDate);
    const departments = await buildDepartmentAnalytics([...propertyIds], portfolioBusinessDate);

    const totalRooms = snapshots.reduce((sum, item) => sum + item.kpi.availableRooms, 0);
    const occupiedRooms = snapshots.reduce((sum, item) => sum + item.kpi.occupiedRooms, 0);
    const totalRevenue = snapshots.reduce((sum, item) => sum + item.kpi.revenue.totalRevenue, 0);
    const roomRevenue = snapshots.reduce((sum, item) => sum + item.kpi.revenue.roomRevenue, 0);
    const fbRevenue = snapshots.reduce((sum, item) => sum + item.kpi.revenue.fbRevenue + item.kpi.revenue.barRevenue, 0);
    const otherRevenue = snapshots.reduce((sum, item) => sum + item.kpi.revenue.otherRevenue, 0);
    const totalReceivables = snapshots.reduce((sum, item) => sum + item.receivables, 0);
    const trendMap = new Map<string, { revenue: number; occupancy: number; rooms: number }>();

    for (const snapshot of snapshots) {
      for (const day of snapshot.trend.days) {
        const current = trendMap.get(day.businessDate) || { revenue: 0, occupancy: 0, rooms: 0 };
        current.revenue += day.revenue;
        current.occupancy += day.occupancyPct;
        current.rooms += 1;
        trendMap.set(day.businessDate, current);
      }
    }

    const activity = await prisma.auditLog.findMany({
      where: { propertyId: { in: [...propertyIds] }, action: { in: ['GUEST_CHECK_IN', 'PAYMENT_RECEIVED', 'MAINTENANCE_TICKET_CREATED', 'ROOM_STATUS_UPDATED'] } },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, action: true, createdAt: true, newValue: true, propertyId: true },
    });

    return successResponse({
      generatedAt: new Date().toISOString(),
      scope: { propertyId: requestedPropertyId || 'ALL', properties },
      kpis: {
        revenueToday: totalRevenue,
        roomRevenue,
        fbRevenue,
        otherRevenue,
        occupancy: totalRooms > 0 ? Number(((occupiedRooms / totalRooms) * 100).toFixed(1)) : 0,
        adr: occupiedRooms > 0 ? Number((roomRevenue / occupiedRooms).toFixed(2)) : 0,
        revpar: totalRooms > 0 ? Number((roomRevenue / totalRooms).toFixed(2)) : 0,
        occupiedRooms,
        availableRooms: totalRooms,
        activeGuests: snapshots.reduce((sum, item) => sum + item.activeGuests, 0),
        arrivals: snapshots.reduce((sum, item) => sum + item.arrivals, 0),
        departures: snapshots.reduce((sum, item) => sum + item.departures, 0),
        receivables: totalReceivables,
        receivablesCount: snapshots.reduce((sum, item) => sum + item.receivablesCount, 0),
        pendingApprovals: snapshots.reduce((sum, item) => sum + item.pendingApprovals, 0),
        housekeepingOpen: snapshots.reduce((sum, item) => sum + item.housekeepingOpen, 0),
        maintenanceOpen: snapshots.reduce((sum, item) => sum + item.maintenanceOpen, 0),
        offlineTerminals: snapshots.reduce((sum, item) => sum + item.sync.offline, 0),
      },
      trend: Array.from(trendMap.entries()).map(([date, value]) => ({ date, revenue: value.revenue, occupancyPct: value.rooms > 0 ? Number((value.occupancy / value.rooms).toFixed(1)) : 0 })),
      properties: snapshots.map((item) => ({
        id: item.id,
        name: item.name,
        code: item.code,
        occupancy: item.kpi.occupancyPercent,
        adr: item.kpi.adr,
        revpar: item.kpi.revpar,
        revenue: item.kpi.revenue.totalRevenue,
        outOfOrder: item.kpi.outOfOrderRooms,
        arrivals: item.arrivals,
        departures: item.departures,
        alerts: item.pendingApprovals + item.housekeepingOpen + item.maintenanceOpen + item.sync.offline,
      })),
      inventory: inventoryAndAudit.inventory,
      audit: inventoryAndAudit.audit,
      departments,
      activity: activity.map((event) => ({ id: event.id, action: event.action, property: properties.find((property) => property.id === event.propertyId)?.name || 'System', timeAgo: event.createdAt.toISOString(), details: event.newValue })),
    });
  } catch (error) {
    console.error('[Dashboard Analytics GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating analytics', 500);
  }
}
