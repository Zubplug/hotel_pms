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
    const limit = Math.min(500, parseInt(searchParams.get('limit') || '500', 10));
    const cursorStr = searchParams.get('cursor');

    if (!propertyId) {
      return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    }

    const allowedPropertyIds = await getUserPropertyIds(session.user.id);
    if (!allowedPropertyIds.includes(propertyId)) {
      return errorResponse('FORBIDDEN', 'No access to this property', 403);
    }

    // Parse cursor if provided
    let cursorUpdatedAt: Date | null = null;
    let cursorId: string | null = null;

    if (cursorStr) {
      try {
        const cursor = JSON.parse(cursorStr);
        if (cursor.updatedAt && cursor.id) {
          cursorUpdatedAt = new Date(cursor.updatedAt);
          cursorId = cursor.id;
        }
      } catch (e) {
        return errorResponse('BAD_REQUEST', 'Invalid cursor format', 400);
      }
    }

    // Determine the organization ID for this property to fetch organization-wide guests
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);
    
    // Build compound cursor where clause
    let whereClause: any = {
      organizationId: property.organizationId
    };

    if (cursorUpdatedAt && cursorId) {
      whereClause = {
        ...whereClause,
        OR: [
          { updatedAt: { gt: cursorUpdatedAt } },
          { 
            updatedAt: cursorUpdatedAt,
            id: { gt: cursorId }
          }
        ]
      };
    }

    // Query with deterministic order
    const guests = await prisma.guest.findMany({
      where: whereClause,
      orderBy: [
        { updatedAt: 'asc' },
        { id: 'asc' }
      ],
      take: limit + 1, // Fetch one extra to determine hasMore
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        companyName: true,
        isVip: true,
        vipLevel: true,
        updatedAt: true,
        deletedAt: true
      }
    });

    const hasMore = guests.length > limit;
    const paginatedGuests = hasMore ? guests.slice(0, limit) : guests;

    let nextCursor = null;
    if (paginatedGuests.length > 0) {
      const lastGuest = paginatedGuests[paginatedGuests.length - 1];
      nextCursor = {
        updatedAt: lastGuest.updatedAt.toISOString(),
        id: lastGuest.id
      };
    }

    return successResponse({
      items: paginatedGuests,
      nextCursor,
      hasMore
    });

  } catch (err) {
    console.error('[Guest Sync GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
