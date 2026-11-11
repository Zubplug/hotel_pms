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

    // New clients use an immutable ID keyset. Keep accepting the previous
    // timestamp+id cursor so already-installed terminals do not fail with a
    // 400 until they are upgraded.
    let cursorId: string | null = null;
    let legacyCursor: { updatedAt: Date; id: string } | null = null;

    if (cursorStr) {
      try {
        const cursor = JSON.parse(cursorStr);
        if (!cursor || typeof cursor !== 'object' || !cursor.id) {
          return errorResponse('BAD_REQUEST', 'Invalid cursor format', 400);
        }

        if (cursor.mode === 'id-v1') {
          cursorId = String(cursor.id);
        } else if (cursor.updatedAt) {
          const updatedAt = new Date(String(cursor.updatedAt));
          if (Number.isNaN(updatedAt.getTime())) {
            return errorResponse('BAD_REQUEST', 'Invalid cursor format', 400);
          }
          legacyCursor = { updatedAt, id: String(cursor.id) };
        } else {
          return errorResponse('BAD_REQUEST', 'Invalid cursor format', 400);
        }
      } catch (e) {
        return errorResponse('BAD_REQUEST', 'Invalid cursor format', 400);
      }
    }

    // Build compound cursor where clause using the authenticated organization ID and property ID
    let whereClause: any = {
      organizationId: authResult.organizationId,
      propertyId: propertyId
    };

    if (cursorId) {
      whereClause = {
        ...whereClause,
        id: { gt: cursorId }
      };
    } else if (legacyCursor) {
      whereClause = {
        ...whereClause,
        OR: [
          { updatedAt: { gt: legacyCursor.updatedAt } },
          { updatedAt: legacyCursor.updatedAt, id: { gt: legacyCursor.id } }
        ]
      };
    }

    // Legacy clients need the old timestamp+id ordering. New clients use the
    // immutable ID ordering, which is not affected by timestamp precision.
    const guests = await prisma.guest.findMany({
      where: whereClause,
      orderBy: legacyCursor
        ? [{ updatedAt: 'asc' }, { id: 'asc' }]
        : { id: 'asc' },
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
        mode: 'id-v1',
        id: lastGuest.id,
        // Keep the legacy fields in the response so older terminals can
        // continue sending their timestamp+id cursor during the upgrade
        // window. New terminals ignore this field and use mode/id.
        updatedAt: lastGuest.updatedAt.toISOString()
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
