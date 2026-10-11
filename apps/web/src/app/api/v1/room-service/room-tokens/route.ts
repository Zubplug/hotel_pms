import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';
import prisma from '@hotel-pms/db';
import { signRoomQrToken } from '@/lib/room-service/qrToken';
import { successResponse, errorResponse } from '@/lib/api-response';

/**
 * POST /api/v1/room-service/room-tokens
 *
 * Generates HMAC-signed QR tokens for a list of room IDs.
 * Requires staff authentication (session cookie OR operator Bearer token).
 *
 * Body: { roomIds: string[] }
 * Returns: { tokens: { roomId: string; token: string }[] }
 */
export async function POST(req: NextRequest) {
  try {
    let propertyId: string | null = null;

    // Prefer operator token (desktop POS context), fall back to web session
    const authHeader = req.headers.get('Authorization');
    const bearerToken = authHeader?.replace('Bearer ', '').trim();

    if (bearerToken) {
      const payload = await verifyOperatorToken(bearerToken);
      if (!payload) {
        return errorResponse('UNAUTHORIZED', 'Invalid or expired operator token', 401);
      }
      propertyId = payload.propertyId;
    } else {
      const session = await auth();
      if (!session?.user) {
        return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
      }
      propertyId = (session.user as any).propertyId ?? null;
    }

    if (!propertyId) {
      return errorResponse('BAD_REQUEST', 'Could not determine property from credentials', 400);
    }

    const body = await req.json();
    const roomIds: string[] = Array.isArray(body?.roomIds) ? body.roomIds : [];

    if (roomIds.length === 0) {
      return errorResponse('BAD_REQUEST', 'roomIds array is required and must not be empty', 400);
    }
    if (roomIds.length > 500) {
      return errorResponse('BAD_REQUEST', 'Cannot generate more than 500 tokens per request', 400);
    }

    // Verify all requested rooms belong to this property (prevents cross-property token forgery)
    const validRooms = await prisma.room.findMany({
      where: { id: { in: roomIds }, propertyId },
      select: { id: true },
    });
    const validRoomIds = new Set(validRooms.map(r => r.id));

    const tokens = roomIds
      .filter(id => validRoomIds.has(id))
      .map(roomId => ({
        roomId,
        token: signRoomQrToken(propertyId!, roomId),
      }));

    return successResponse({ tokens });
  } catch (err: any) {
    console.error('[POST /api/v1/room-service/room-tokens]', err);
    return errorResponse('INTERNAL_ERROR', err?.message || 'Failed to generate tokens', 500);
  }
}
