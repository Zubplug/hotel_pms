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
      activity: activity.map((event) => ({ id: event.id, action: event.action, property: properties.find((property) => property.id === event.propertyId)?.name || 'System', timeAgo: event.createdAt.toISOString(), details: event.newValue })),
    });
  } catch (error) {
    console.error('[Dashboard Analytics GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating analytics', 500);
  }
}
