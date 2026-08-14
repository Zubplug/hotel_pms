import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse, paginatedResponse } from '@/lib/api-response';
import { getUserPropertyIds } from '@/lib/property-access';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const page     = Math.max(1, parseInt(searchParams.get('page')     ?? '1'));
    const pageSize = Math.min(100, parseInt(searchParams.get('pageSize') ?? '20'));
    const search   = searchParams.get('search') ?? '';
    const status   = searchParams.get('status') ?? '';
    const propertyId = searchParams.get('propertyId') ?? '';

    const allowedPropertyIds = await getUserPropertyIds(session.user.id);
    if (allowedPropertyIds.length === 0) {
      return paginatedResponse([], { page, pageSize, total: 0, totalPages: 0 });
    }

    const where: Record<string, unknown> = {
      propertyId: {
        in: propertyId && allowedPropertyIds.includes(propertyId)
          ? [propertyId]
          : allowedPropertyIds,
      },
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { confirmationNumber: { contains: search, mode: 'insensitive' } },
              { primaryGuest: { firstName: { contains: search, mode: 'insensitive' } } },
              { primaryGuest: { lastName:  { contains: search, mode: 'insensitive' } } },
              { primaryGuest: { email:     { contains: search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };

    const [total, reservations] = await Promise.all([
      prisma.reservation.count({ where }),
      prisma.reservation.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { checkIn: 'asc' },
        include: {
          primaryGuest: { select: { firstName: true, lastName: true, email: true, phone: true } },
          property: { select: { name: true, city: true } },
          reservationRooms: {
            include: {
              room: { select: { number: true, status: true, roomType: { select: { name: true } } } },
            },
          },
        },
      }),
    ]);

    return paginatedResponse(reservations, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    });
  } catch (err) {
    console.error('[Reservations GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
