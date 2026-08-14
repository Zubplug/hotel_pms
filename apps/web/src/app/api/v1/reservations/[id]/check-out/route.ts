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
      select: { id: true, status: true, propertyId: true, reservationRooms: { include: { room: true } } },
    });

    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
    if (reservation.status !== 'CHECKED_IN') {
      return errorResponse('INVALID_STATE', `Cannot check out a reservation with status ${reservation.status}`, 409);
    }

    await assertPropertyAccess(session.user.id, reservation.propertyId);
    const canCheckOut = await hasPermission(session.user.id, 'reservation', 'update', reservation.propertyId);
    if (!canCheckOut) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    // 1. Transition reservation to CHECKED_OUT immediately (don't block on USB encoder)
    await prisma.reservation.update({
      where: { id },
      data: { status: 'CHECKED_OUT' },
    });

    // 2. Mark room as DIRTY
    for (const rr of reservation.reservationRooms) {
      if (rr.room) {
        await prisma.room.update({
          where: { id: rr.room.id },
          data: { status: 'DIRTY', housekeepingStatus: 'DIRTY' },
        });
      }
    }

    // 3. Queue credential revocation (non-blocking — don't fail checkout if no agent online)
    let revokedCount = 0;
    try {
      revokedCount = await lockOrchestrator.revokeReservationCredentials(id, reservation.propertyId);
    } catch (hwErr) {
      console.error('[Check-Out] Revocation dispatch failed (non-blocking):', hwErr);
    }

    return successResponse({
      message: 'Check-out complete.',
      revokedCredentials: revokedCount,
      revocationStatus: revokedCount > 0 ? 'QUEUED' : 'NONE',
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Check-Out POST]', err);
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}
