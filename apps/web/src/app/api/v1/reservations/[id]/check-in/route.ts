import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { assertPropertyAccess } from '@/lib/property-access';
import { lockOrchestrator } from '@/lib/locks/orchestrator';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        propertyId: true,
      },
    });

    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);

    // Only CONFIRMED or PENDING reservations can check in
    if (!['CONFIRMED', 'PENDING'].includes(reservation.status)) {
      return errorResponse('INVALID_STATE', `Cannot check in a reservation with status ${reservation.status}`, 409);
    }

    await assertPropertyAccess(session.user.id, reservation.propertyId);
    const canCheckIn = await hasPermission(session.user.id, 'reservation', 'update', reservation.propertyId);
    if (!canCheckIn) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    // Delegate entirely to the LockOrchestrator.
    // Idempotent: clicking Check In 5 times returns the same operation.
    const operation = await lockOrchestrator.generateCredentialForCheckIn(id, reservation.propertyId);

    // Transition reservation to CHECKED_IN
    if (reservation.status !== 'CHECKED_IN') {
      await prisma.reservation.update({
        where: { id },
        data: { status: 'CHECKED_IN' },
      });
    }

    return successResponse({
      message: 'Check-in initiated. Hardware agent is preparing the key.',
      operationId: operation.id,
      operationStatus: operation.status,
    }, 202);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Check-In POST]', err);
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}
