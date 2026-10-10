import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma, { AuthoritativeAvailabilityService } from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const roomTypeId = searchParams.get('roomTypeId');
    const checkIn = searchParams.get('checkIn');
    const checkOut = searchParams.get('checkOut');

    if (!propertyId || !checkIn || !checkOut) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }

    if (!ctx.propertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime()) || checkOutDate <= checkInDate) {
      return errorResponse('BAD_REQUEST', 'Invalid date range', 400);
    }

    const roomTypeIds = roomTypeId
      ? [roomTypeId]
      : (await prisma.roomType.findMany({
          where: { propertyId, isActive: true, deletedAt: null },
          select: { id: true },
        })).map((roomType) => roomType.id);

    const availableRoomIds = (await Promise.all(roomTypeIds.map(async (id) => {
      const rooms = await AuthoritativeAvailabilityService.findAssignableRooms(prisma as any, {
        propertyId,
        roomTypeId: id,
        checkIn: checkInDate,
        checkOut: checkOutDate,
      });
      return rooms.map((room) => room.id);
    }))).flat();

    const availableRooms = await prisma.room.findMany({
      where: { id: { in: availableRoomIds } },
      include: { roomType: { select: { id: true, name: true, baseRate: true, currency: true } } },
      orderBy: { number: 'asc' },
    });

    return successResponse(availableRooms);
  } catch (err) {
    console.error('[Available Rooms GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
