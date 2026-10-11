import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { verifyRoomQrToken } from '@/lib/room-service/qrToken';

// GET /api/v1/room-service/room-info?t=<signedToken>&rn=<roomNo>
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Signed token is now mandatory — unsigned (plain propertyId/roomId) params
    // are no longer accepted.  Guests with old printed cards will see a clear
    // "reprint needed" message instead of a silent auth bypass.
    const rawToken = searchParams.get('t');
    if (!rawToken) {
      return errorResponse(
        'TOKEN_REQUIRED',
        'This QR code is outdated. Please ask the front desk for a new tent card.',
        401
      );
    }

    const verified = verifyRoomQrToken(rawToken);
    if (!verified) {
      return errorResponse(
        'INVALID_TOKEN',
        'The QR code is invalid or has been tampered with. Please ask the front desk for a new card.',
        401
      );
    }

    const propertyId = verified.propertyId;
    const roomId     = verified.roomId;

    if (!propertyId || !roomId) {
      return errorResponse('BAD_REQUEST', 'Token missing required fields', 400);
    }

    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: {
        id: true,
        name: true,
        baseCurrency: true,
        phone: true,
      },
    });

    if (!property) {
      return errorResponse('NOT_FOUND', 'Property not found', 404);
    }

    // Find the room — use roomType (correct relation name)
    const room = await prisma.room.findFirst({
      where: {
        propertyId,
        ...(roomId ? { id: roomId } : {}),
      },
      include: {
        roomType: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!room) {
      return errorResponse('NOT_FOUND', 'Room not found for this property', 404);
    }

    // Check for active checked-in reservation on this room
    const resRoom = await prisma.reservationRoom.findFirst({
      where: {
        roomId: room.id,
        reservation: {
          propertyId,
          status: 'CHECKED_IN',
        },
      },
      select: {
        reservationId: true,
        reservation: {
          select: {
            id: true,
            primaryGuestId: true,
            primaryGuest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            folios: {
              where: { closedAt: null },
              select: {
                id: true,
                folioNumber: true,
                balance: true,
              },
              take: 1,
            },
          },
        },
      },
    });

    const reservation = resRoom?.reservation ?? null;
    const isCheckedIn = !!reservation;
    const guest = reservation?.primaryGuest ?? null;
    const folio = reservation?.folios?.[0] ?? null;

    return successResponse({
      property: {
        id: property.id,
        name: property.name,
        currency: property.baseCurrency || 'NGN',
        phone: property.phone,
      },
      room: {
        id: room.id,
        number: room.number,
        name: room.name || `Room ${room.number}`,
        type: room.roomType?.name || 'Standard',
      },
      stay: isCheckedIn
        ? {
            isCheckedIn: true,
            reservationId: reservation!.id,
            guestName: guest
              ? `${guest.firstName} ${guest.lastName?.[0] ? guest.lastName[0] + '.' : ''}`.trim()
              : 'Guest',
            folioId: folio?.id || null,
            canChargeToRoom: !!folio,
          }
        : {
            isCheckedIn: false,
            reservationId: null,
            guestName: null,
            folioId: null,
            canChargeToRoom: false,
          },
    });
  } catch (err: any) {
    console.error('[GET /api/v1/room-service/room-info]', err);
    return errorResponse('INTERNAL_ERROR', err?.message || 'Failed to verify room', 500);
  }
}
