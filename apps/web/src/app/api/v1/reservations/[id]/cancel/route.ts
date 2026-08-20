import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import { NotificationEngine } from '@/lib/notification-engine';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    
    const { id } = await params;
    const body = await req.json();
    const reason = body?.reason || 'No reason provided';
    
    // 1. Verify property access and get the existing reservation
    const existingReservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        reservationRooms: true,
        property: { select: { organizationId: true } }
      }
    });

    if (!existingReservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
    await assertPropertyAccess(session.user.id, existingReservation.propertyId);

    // Business Logic: Only CONFIRMED reservations can be cancelled.
    if (existingReservation.status !== 'CONFIRMED') {
      return errorResponse('BAD_REQUEST', `Cannot cancel a reservation that is ${existingReservation.status}`, 400);
    }

    // 2. Perform transactional cancellation
    const cancelled = await prisma.$transaction(async (tx) => {
      const updatedResRoom = await tx.reservationRoom.update({
        where: { id: existingReservation.reservationRooms[0].id },
        data: { status: 'CANCELLED' }
      });

      const updatedRes = await tx.reservation.update({
        where: { id },
        data: { status: 'CANCELLED', cancellationReason: reason }
      });

      const organizationId = existingReservation.property.organizationId;
      const propertyId = existingReservation.propertyId;

      await tx.auditLog.create({
        data: {
          organizationId,
          propertyId,
          userId: session.user.id,
          userEmail: session.user.email,
          userRole: (session.user as any).role || 'STAFF',
          action: 'RESERVATION_CANCELLED',
          resource: 'Reservation',
          resourceId: id,
          previousValue: { status: existingReservation.status },
          newValue: { status: 'CANCELLED', reason },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'Unknown',
          requestId: req.headers.get('x-request-id') || crypto.randomUUID(),
        },
      });

      return { updatedRes, updatedResRoom, organizationId };
    });

    const rateSnapshot = existingReservation.ratePlanSnapshot as any;
    const bookingValue = rateSnapshot?.total || 0;

    await NotificationEngine.emit({
      type: 'SIGNIFICANT_CANCELLATION',
      organizationId: cancelled.organizationId,
      propertyId: existingReservation.propertyId,
      entityType: 'reservation',
      entityId: id,
      idempotencyKey: `sig_cxl_${id}`,
      metadata: {
         bookingValue,
         isVip: false // VIP check can be added later
      }
    });

    await NotificationEngine.emit({
      type: 'RESERVATION_CANCELLED',
      organizationId: cancelled.organizationId,
      propertyId: existingReservation.propertyId,
      entityType: 'reservation',
      entityId: id,
      idempotencyKey: `res_cancelled_${id}`,
      metadata: { reason },
    });

    return successResponse(cancelled.updatedRes);
  } catch (err: any) {
    console.error('[Reservation Cancel POST]', err);
    return errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', 500);
  }
}
