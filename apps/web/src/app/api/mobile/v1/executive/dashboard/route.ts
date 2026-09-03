import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { getPropertyBusinessDate, getExecutiveOverview, getRoomSummary, getExecutiveRevenueTrend, getSyncSummary } from '@/lib/kpi';
import { evaluatePropertyAlerts } from '@/lib/attention-engine';
import { fetchHotelPulse } from '@/lib/executive/hotel-pulse';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    const ctx = await requireOrganizationContext(user.id);
    const primaryPropertyId = ctx.propertyIds[0];
    if (!primaryPropertyId) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }

    const prismaModule = await import('@hotel-pms/db');
    const prisma = prismaModule.default;
    const property = await prisma.property.findUnique({
      where: { id: primaryPropertyId },
      select: { id: true, name: true, timezone: true }
    });

    if (!property) {
      return errorResponse('NOT_FOUND', 'Property not found', 404);
    }

    const businessDate = await getPropertyBusinessDate(primaryPropertyId);

    const [
      executiveOverview,
      roomSummary,
      performanceTrends,
      syncSummary,
      activeAlerts,
      hotelPulse
    ] = await Promise.all([
      getExecutiveOverview(primaryPropertyId, businessDate),
      getRoomSummary(primaryPropertyId),
      getExecutiveRevenueTrend(primaryPropertyId, businessDate, 7),
      getSyncSummary(primaryPropertyId),
      evaluatePropertyAlerts(primaryPropertyId),
      fetchHotelPulse(primaryPropertyId)
    ]);

    const now = new Date();

    return successResponse({
      property: {
        id: property.id,
        name: property.name,
        timezone: property.timezone
      },
      businessDate: businessDate.toISOString().split('T')[0],
      generatedAt: now.toISOString(),
      
      executiveOverview,
      todaySnapshot: {
        arrivals: hotelPulse.arrivals,
        departures: hotelPulse.departures,
        inHouseGuests: hotelPulse.inHouseGuests,
        occupiedRooms: executiveOverview.occupiedRooms,
        availableRooms: executiveOverview.availableRooms,
        outOfOrderRooms: roomSummary.ooo
      },
      roomSummary,
      performanceTrends,
      requiresAttention: activeAlerts,
      syncSummary
    }, 200);

  } catch (err: any) {
    console.error('[Mobile Executive Dashboard API]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error generating executive dashboard', 500);
  }
}
