import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const { searchParams } = new URL(req.url);
    const roomNo = searchParams.get('roomNo');
    const propertyId = searchParams.get('propertyId');

    if (!roomNo || !propertyId) return errorResponse('BAD_REQUEST', 'Missing roomNo or propertyId', 400);

    await assertPropertyAccess(session.user.id, propertyId);


    const resRoom = await prisma.reservationRoom.findFirst({
      where: {
        room: {
          OR: [
            { number: roomNo },
            { code: roomNo }
          ],
          propertyId,
        },
        reservation: {
          status: 'CHECKED_IN'
        }
      },
      include: {
        reservation: {
          include: {
            primaryGuest: true,
            folios: true,
          }
        },
        room: true
      }
    });

    if (!resRoom || !resRoom.reservation) {
      return successResponse({ reservation: null });
    }

    // Calculate folio balance
    const balance = resRoom.reservation.folios.reduce((sum: number, f: any) => sum + Number(f.balance), 0);

    return successResponse({
      reservation: {
        ...resRoom.reservation,
        room: resRoom.room,
        balance
      }
    });
  } catch (err) {
    console.error('[Lookup API]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
