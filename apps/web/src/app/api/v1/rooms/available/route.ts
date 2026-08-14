import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const roomTypeId = searchParams.get('roomTypeId');
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');

    if (!propertyId || !roomTypeId || !checkIn || !checkOut) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }

    const allowedPropertyIds = await getUserPropertyIds(session.user.id);
    if (!allowedPropertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
      return errorResponse('BAD_REQUEST', 'Invalid date range', 400);
    }

    // Overlap logic: checkIn < existingCheckOut AND checkOut > existingCheckIn
    const availableRooms = await prisma.room.findMany({
      where: {
        propertyId,
        roomTypeId,
        // Exclude rooms that are out of order or maintenance entirely (business logic decision)
        status: { notIn: ['MAINTENANCE', 'OUT_OF_ORDER'] },
        reservationRooms: {
          none: {
            status: { notIn: ['CANCELLED', 'NO_SHOW'] },
            AND: [
              { checkIn: { lt: checkOutDate } },
              { checkOut: { gt: checkInDate } },
            ],
          },
        },
        roomBlocks: {
          none: {
            AND: [
              { startDate: { lt: checkOutDate } },
              { endDate: { gt: checkInDate } },
            ],
          },
        },
      },
      orderBy: { number: 'asc' },
    });

    return successResponse(availableRooms);
  } catch (err) {
    console.error('[Available Rooms GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
