import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        primaryGuest: true,
        property: { select: { id: true, name: true, city: true } },
        reservationRooms: {
          include: {
            room: {
              include: {
                doorLocks: { select: { id: true, lockCode: true, provider: true, status: true } },
                roomType: { select: { name: true, defaultBedConfig: true } },
              },
            },
          },
        },
        lockOperations: {
          orderBy: { requestedAt: 'desc' },
          take: 20,
        },
        lockCredentials: {
          where: { status: { in: ['ACTIVE', 'PENDING'] } },
          orderBy: { createdAt: 'desc' },
          select: { id: true, status: true, credentialType: true, validFrom: true, validUntil: true, metadata: true, issuedAt: true },
        },
      },
    });

    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);

    await assertPropertyAccess(session.user.id, reservation.propertyId);

    return successResponse(reservation);
  } catch (err: any) {
    if (err?.code === 'FORBIDDEN') return errorResponse('FORBIDDEN', err.message, 403);
    return errorResponse('INTERNAL_ERROR', err instanceof Error ? err.message : String(err), 500, err instanceof Error ? { stack: err.stack } : undefined);
  }
}
