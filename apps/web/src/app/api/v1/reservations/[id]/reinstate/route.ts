import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { assertPropertyAccess } from '@/lib/property-access';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

const MANAGER_ROLES = ['ADMIN', 'SUPER_ADMIN', 'MANAGER', 'CEO', 'FINANCE_MANAGER'];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const reservation = await prisma.reservation.findUnique({ where: { id }, include: { property: true, noShowPolicy: true, reservationRooms: { where: { status: 'NO_SHOW' }, include: { room: true } } } });
    if (!reservation) return errorResponse('NOT_FOUND', 'Reservation not found', 404);
    await assertPropertyAccess(session.user.id, reservation.propertyId);
    if (await isNightAuditTransactionLocked(reservation.propertyId)) {
      return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Reservation changes are temporarily paused while Night Audit is posting.', 409);
    }
    if (reservation.status !== 'NO_SHOW') return errorResponse('BAD_REQUEST', `Only NO_SHOW reservations can be reinstated; current status is ${reservation.status}`, 400);
    if (reservation.noShowPolicy?.allowReinstatement === false) return errorResponse('FORBIDDEN', 'This property policy does not allow reinstatement.', 403);
    const isManager = MANAGER_ROLES.includes((session.user as any).role || '') || (session.user as any).isSuperAdmin;
    if (reservation.noShowPolicy?.reinstatementRequiresApproval !== false && !isManager) return errorResponse('FORBIDDEN', 'Manager approval is required to reinstate a no-show reservation.', 403);

    const activeRefund = await prisma.refundRequest.findFirst({ where: { reservationId: id, status: { in: ['PENDING_APPROVAL', 'APPROVED', 'PROCESSING', 'COMPLETED'] } } });
    if (activeRefund) return errorResponse('CONFLICT', 'This reservation has a refund workflow in progress or completed. Cancel or reconcile it before reinstatement.', 409);

    for (const roomAssignment of reservation.reservationRooms) {
      const occupied = await prisma.reservationRoom.findFirst({ where: { roomId: roomAssignment.roomId, status: 'ACTIVE', reservationId: { not: id } } });
      if (occupied) return errorResponse('CONFLICT', 'The assigned room is no longer available.', 409);
    }

    const reinstated = await prisma.$transaction(async tx => {
      const updated = await tx.reservation.update({ where: { id }, data: { status: 'CONFIRMED', reinstatedAt: new Date(), reinstatedBy: session.user.id, reinstatementReason: String(body.reason || 'No-show reinstated by management') } });
      await tx.reservationRoom.updateMany({ where: { reservationId: id, status: 'NO_SHOW' }, data: { status: 'ACTIVE' } });
      for (const roomAssignment of reservation.reservationRooms) {
        if (!roomAssignment.roomId) continue;
        await tx.room.update({ where: { id: roomAssignment.roomId }, data: { status: 'RESERVED' } });
      }
      await tx.auditLog.create({ data: { organizationId: reservation.property.organizationId, propertyId: reservation.propertyId, userId: session.user.id, userEmail: session.user.email, userRole: (session.user as any).role || 'STAFF', action: 'RESERVATION_REINSTATED', resource: 'Reservation', resourceId: id, previousValue: { status: 'NO_SHOW' }, newValue: { status: 'CONFIRMED', reason: body.reason || 'No-show reinstated by management' }, ipAddress: req.headers.get('x-forwarded-for') || '', userAgent: req.headers.get('user-agent') || '', requestId: req.headers.get('x-request-id') || crypto.randomUUID() } });
      return updated;
    });
    return successResponse({ reservation: reinstated, requiresCheckIn: true });
  } catch (error) {
    console.error('[Reservation Reinstate POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to reinstate reservation', 500);
  }
}
