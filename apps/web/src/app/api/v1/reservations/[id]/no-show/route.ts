import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import { calculateNoShowAssessment } from '@/lib/refunds/no-show';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: {
        property: { select: { organizationId: true } },
        noShowPolicy: true,
        reservationRooms: { where: { status: 'ACTIVE' } },
        folios: { include: { items: true, payments: { where: { status: 'COMPLETED' } } } },
      },
    });
    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
    await assertPropertyAccess(session.user.id, reservation.propertyId);
    if (reservation.status !== 'CONFIRMED') return errorResponse('BAD_REQUEST', `Cannot assess a reservation that is ${reservation.status}`, 400);
    if (reservation.lateArrivalExpected && !body.overrideLateArrival) return errorResponse('CONFLICT', 'Late arrival is authorized for this reservation.', 409);

    const policy = reservation.noShowPolicy;
    const cutoff = new Date(reservation.checkIn);
    const [cutoffHour, cutoffMinute] = String(policy?.cutoffTime || '02:00').split(':').map(Number);
    cutoff.setUTCHours(24 + (Number.isFinite(cutoffHour) ? cutoffHour : 2), Number.isFinite(cutoffMinute) ? cutoffMinute : 0, 0, 0);
    cutoff.setTime(cutoff.getTime() + (policy?.gracePeriodMinutes || 0) * 60_000);
    if (new Date() < cutoff && !body.overrideCutoff) return errorResponse('CONFLICT', `No-show assessment is available after ${cutoff.toISOString()}.`, 409);
    const bookedValue = Number((reservation.ratePlanSnapshot as any)?.total || 0) || reservation.folios.flatMap(folio => folio.items).filter(item => item.type === 'CHARGE' && item.source === 'ROOM_CHARGE' && !item.voidedAt).reduce((sum, item) => sum + Number(item.amount), 0);
    const totalPaid = reservation.folios.flatMap(folio => folio.payments).reduce((sum, payment) => sum + Number(payment.amount), 0);
    const assessment = calculateNoShowAssessment({ checkIn: reservation.checkIn, checkOut: reservation.checkOut, bookedValue, totalPaid, chargeType: policy?.chargeType || 'FIRST_NIGHT', chargeValue: Number(policy?.chargeValue || 0), refundableUnusedNights: policy?.refundableUnusedNights ?? true });

    const result = await prisma.$transaction(async tx => {
      const updated = await tx.reservation.update({ where: { id }, data: { status: 'NO_SHOW', noShowAt: new Date(), noShowBy: session.user.id, noShowAssessedAt: new Date(), noShowChargeAmount: assessment.noShowCharge, noShowRefundableAmount: assessment.refundableAmount } });
      if (reservation.reservationRooms.length) await tx.reservationRoom.updateMany({ where: { reservationId: id, status: 'ACTIVE' }, data: { status: 'NO_SHOW' } });
      await tx.auditLog.create({ data: { organizationId: reservation.property.organizationId, propertyId: reservation.propertyId, userId: session.user.id, userEmail: session.user.email, userRole: (session.user as any).role || 'STAFF', action: 'RESERVATION_NO_SHOW_ASSESSED', resource: 'Reservation', resourceId: id, previousValue: { status: reservation.status }, newValue: { status: 'NO_SHOW', chargeAmount: assessment.noShowCharge, refundableAmount: assessment.refundableAmount }, ipAddress: req.headers.get('x-forwarded-for') || '', userAgent: req.headers.get('user-agent') || '', requestId: req.headers.get('x-request-id') || crypto.randomUUID() } });
      return updated;
    });
    return successResponse({ reservation: result, assessment, refundRequired: assessment.refundableAmount > 0 });
  } catch (error: any) {
    console.error('[Reservation No-Show POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to assess no-show', 500);
  }
}
