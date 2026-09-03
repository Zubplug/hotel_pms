import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { calculateRoomStatuses } from '@/lib/executive/room-status';
import { getPropertyBusinessDate } from '@/lib/kpi';
import { successResponse, errorResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) {
      return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    }
    const ctx = await requireOrganizationContext(user.id);
    const allowedPropertyIds = ctx.propertyIds;
    if (allowedPropertyIds.length === 0) {
      return errorResponse('FORBIDDEN', 'No property access', 403);
    }

    if (allowedPropertyIds.length === 0) {
      return NextResponse.json({ success: false, error: 'No property access' }, { status: 403 });
    }

    const propertyId = allowedPropertyIds[0];

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true, timezone: true, checkInTime: true }
    });

    if (!property) {
      return NextResponse.json({ success: false, error: 'Property not found or access denied' }, { status: 403 });
    }

    // 2. Authoritative business date
    const businessDate = await getPropertyBusinessDate(propertyId);

    // 3. Shared status calculation
    const { overview, rooms: baseRooms } = await calculateRoomStatuses(propertyId, businessDate);

    // 4. Mobile-specific Enrichment Layer
    const startOfDay = new Date(businessDate);
    startOfDay.setUTCHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

    const roomIds = baseRooms.map((r) => r.id);

    // Get current/next reservations efficiently for all returned rooms
    const activeReservations = await prisma.reservationRoom.findMany({
      where: {
        roomId: { in: roomIds },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        checkIn: { lt: endOfDay },
        checkOut: { gt: startOfDay }
      },
      include: {
        reservation: { select: { id: true, primaryGuest: true } }
      }
    });
    const currentResMap = new Map(activeReservations.map((r) => [r.roomId, r]));

    const upcomingReservations = await prisma.reservationRoom.findMany({
      where: {
        roomId: { in: roomIds },
        status: { notIn: ['CANCELLED', 'NO_SHOW'] },
        checkIn: { gte: startOfDay }
      },
      orderBy: { checkIn: 'asc' },
      include: {
        reservation: { select: { id: true, primaryGuest: true } }
      }
    });
    // Group upcoming by room to find the true "next" arrival
    const nextArrivalMap = new Map();
    for (const res of upcomingReservations) {
      const current = currentResMap.get(res.roomId);
      // Next arrival is either someone arriving strictly after current checkout, 
      // or if vacant, anyone arriving today or later.
      if (!current || res.checkIn.getTime() >= current.checkOut.getTime()) {
        if (!nextArrivalMap.has(res.roomId)) {
          nextArrivalMap.set(res.roomId, res);
        }
      }
    }

    // Get active blocks for maintenance/OOO reasons
    const activeBlocks = await prisma.roomBlock.findMany({
      where: {
        roomId: { in: roomIds },
        status: 'ACTIVE',
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay }
      }
    });
    const blockMap = new Map(activeBlocks.map((b) => [b.roomId, b]));

    // Re-map rooms with enriched data
    const enrichedRooms = baseRooms.map((room) => {
      const currentRes = currentResMap.get(room.id);
      const nextRes = nextArrivalMap.get(room.id);
      const activeBlock = blockMap.get(room.id);

      let guest = null;
      if (currentRes && currentRes.reservation.primaryGuest) {
        guest = {
          name: `${currentRes.reservation.primaryGuest.firstName} ${currentRes.reservation.primaryGuest.lastName}`,
          guests: currentRes.adults || 1,
          checkIn: currentRes.checkIn.toISOString(),
          checkOut: currentRes.checkOut.toISOString()
        };
      }

      let nextArrival = null;
      if (nextRes) {
        nextArrival = {
          arrivalDate: nextRes.checkIn.toISOString().split('T')[0],
          arrivalTime: property.checkInTime || null,
          status: nextRes.status
        };
      }

      const indicators: string[] = [];
      if (activeBlock) indicators.push('MAINTENANCE');
      if (room.housekeepingStatus === 'DIRTY' || room.housekeepingStatus === 'CLEANING') indicators.push('HOUSEKEEPING');
      if (currentRes?.reservation.primaryGuest?.vipLevel) indicators.push('VIP');
      
      // Attention indicator: Room is dirty but arriving today
      if (room.displayStatus === 'DIRTY' && nextRes) {
        const daysToArrival = Math.round((nextRes.checkIn.getTime() - new Date().getTime()) / 86400000);
        if (daysToArrival === 0) indicators.push('ATTENTION');
      }
      
      // Attention indicator: OOO but arriving today/tomorrow
      if ((room.displayStatus === 'OUT_OF_ORDER' || room.displayStatus === 'OUT_OF_SERVICE') && nextRes) {
         const daysToArrival = Math.round((nextRes.checkIn.getTime() - new Date().getTime()) / 86400000);
         if (daysToArrival <= 1) indicators.push('ATTENTION');
      }

      return {
        ...room,
        guest,
        nextArrival,
        indicators
      };
    });

    const now = new Date().toISOString();

    return NextResponse.json({
      success: true,
      data: {
        property: {
          id: property.id,
          name: property.name,
          timezone: property.timezone
        },
        businessDate: businessDate.toISOString().split('T')[0],
        generatedAt: now,
        lastUpdated: now,
        serverTime: now,
        dataAsOf: now,
        overview,
        rooms: enrichedRooms
      }
    });

  } catch (error: any) {
    console.error('[Rooms BFF Error]', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve room status data' },
      { status: 500 }
    );
  }
}
