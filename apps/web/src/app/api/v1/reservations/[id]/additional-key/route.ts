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
    const body = await req.json().catch(() => ({}));
    const guestId: string | undefined = body.guestId;

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      select: { id: true, status: true, propertyId: true },
    });

    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
    if (reservation.status !== 'CHECKED_IN') {
      return errorResponse('INVALID_STATE', 'Reservation must be CHECKED_IN to issue additional keys', 409);
    }

    await assertPropertyAccess(session.user.id, reservation.propertyId);
    const canUpdate = await hasPermission(session.user.id, 'reservation', 'update', reservation.propertyId);
    if (!canUpdate) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const operation = await lockOrchestrator.generateAdditionalCredential(id, guestId, reservation.propertyId);

    return successResponse({
      message: 'Additional key encoding initiated.',
      operationId: operation.id,
      operationStatus: operation.status,
    }, 202);

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Additional Key POST]', err);
    return errorResponse('INTERNAL_ERROR', message, 500);
  }
}
