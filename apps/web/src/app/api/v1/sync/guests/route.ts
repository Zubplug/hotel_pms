import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { authenticateSyncRequest } from '@/lib/sync-auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const limit = Math.min(500, parseInt(searchParams.get('limit') || '500', 10));
    const cursorStr = searchParams.get('cursor');

    if (!propertyId) {
      return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    }

    const authResult = await authenticateSyncRequest(req, propertyId);
    if (!authResult.success) {
      return errorResponse('UNAUTHORIZED', authResult.error, authResult.status);
    }

    // Parse cursor if provided
    let cursorUpdatedAt: Date | null = null;
    let cursorId: string | null = null;

    if (cursorStr) {
      try {
        const cursor = JSON.parse(cursorStr);
        if (!cursor || typeof cursor !== 'object' || !cursor.updatedAt || !cursor.id) {
          return errorResponse('BAD_REQUEST', 'Invalid cursor format', 400);
        }
        const parsedUpdatedAt = new Date(cursor.updatedAt);
        if (Number.isNaN(parsedUpdatedAt.getTime())) {
          return errorResponse('BAD_REQUEST', 'Invalid cursor timestamp', 400);
        }
        cursorUpdatedAt = parsedUpdatedAt;
        cursorId = String(cursor.id);
      } catch (e) {
        return errorResponse('BAD_REQUEST', 'Invalid cursor format', 400);
      }
    }

    // Build compound cursor where clause using the authenticated organization ID and property ID
    let whereClause: any = {
      organizationId: authResult.organizationId,
      propertyId: propertyId
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
        organizationId: true,
        propertyId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        gender: true,
        nationality: true,
        addressLine1: true,
        city: true,
        state: true,
        country: true,
        idType: true,
        companyName: true,
        isVip: true,
        vipLevel: true,
        notes: true,
        createdAt: true,
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
