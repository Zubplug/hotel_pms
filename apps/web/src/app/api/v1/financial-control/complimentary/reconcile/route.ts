import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';
import { resolveUser } from '@/lib/resolve-user';

const REVIEW_ROLES = ['NIGHT_AUDITOR', 'GENERAL_CASHIER', 'ACCOUNTANT', 'FINANCE_MANAGER', 'GENERAL_MANAGER', 'MANAGER', 'DIRECTOR', 'ADMIN', 'CEO', 'SUPER_ADMIN'];

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    if (!REVIEW_ROLES.includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Night Audit approval is required', 403);

    const body = await req.json();
    const { propertyId, reservationRoomId, decision, rejectionReason } = body;
    if (!propertyId || !reservationRoomId || !['APPROVE', 'REJECT'].includes(decision)) {
      return errorResponse('BAD_REQUEST', 'propertyId, reservationRoomId and a valid decision are required', 400);
    }

    const ctx = await requireOrganizationContext(user.id);
    if (!ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);
    if (decision === 'REJECT' && (!rejectionReason || String(rejectionReason).trim().length < 5)) {
      return errorResponse('BAD_REQUEST', 'A rejection reason of at least 5 characters is required', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      const property = await tx.property.findUnique({ where: { id: propertyId }, select: { organizationId: true, businessDate: true } });
      const auditor = await tx.staff.findFirst({ where: { userId: user.id, organizationId: property?.organizationId, isActive: true }, select: { id: true } });
      if (!auditor) throw new Error('STAFF_NOT_FOUND');

      const room = await tx.reservationRoom.findUnique({
        where: { id: reservationRoomId },
        include: { reservation: { select: { id: true, propertyId: true, primaryGuestId: true, createdBy: true } } },
      });
      if (!room || room.reservation.propertyId !== propertyId) throw new Error('RESERVATION_ROOM_NOT_FOUND');
      if (room.discountType !== 'COMPLIMENTARY' || room.status !== 'ACTIVE') throw new Error('COMPLIMENTARY_STATE_CHANGED');

      const operationId = `COMP_RECONCILED_${reservationRoomId}`;
      const existing = await tx.complimentaryRecord.findUnique({ where: { operationId } })
        // Keep compatibility with records created by the earlier reconciliation
        // path, which did not always use the same deterministic operation ID.
        || await tx.complimentaryRecord.findFirst({ where: { propertyId, roomId: room.roomId, guestId: room.reservation.primaryGuestId, businessDate: property?.businessDate || undefined } });
      if (existing) return existing;

      const operator = room.reservation.createdBy
        ? await tx.staff.findFirst({ where: { id: room.reservation.createdBy, propertyAccess: { has: propertyId }, isActive: true }, select: { id: true } })
        : null;
      const operatorId = operator?.id || auditor.id;
      const amount = Number(room.rateAmount);
      const isApproved = decision === 'APPROVE';
      const record = await tx.complimentaryRecord.upsert({
        where: { operationId },
        create: {
          propertyId,
          businessDate: property?.businessDate || new Date(),
          reference: operationId,
          sourceModule: 'FRONT_DESK',
          roomId: room.roomId,
          guestId: room.reservation.primaryGuestId,
          beneficiaryType: 'GUEST',
          settlementType: 'DUTY_MANAGER',
          acknowledgedByStaffId: auditor.id,
          acknowledgedAt: new Date(),
          operatorId,
          operationId,
          grossAmount: amount,
          complAmount: amount,
          netAmount: 0,
          complType: 'FULL',
          reason: room.discountReason || 'Reconciled complimentary reservation',
          notes: JSON.stringify({ source: 'NIGHT_AUDIT_RECONCILIATION', reservationRoomId }),
          status: isApproved ? 'VERIFIED' : 'REVERSED',
          approverId: isApproved ? auditor.id : null,
          nightAuditorId: isApproved ? auditor.id : null,
          verifiedAt: isApproved ? new Date() : null,
          rejectionReason: isApproved ? null : String(rejectionReason).trim(),
        },
        // A repeated Night Audit click is an idempotent retry. Do not change
        // the original audit decision or its audit trail on that retry.
        update: {},
      });

      if (!isApproved && record.status === 'REVERSED') {
        await tx.reservationRoom.update({
          where: { id: reservationRoomId },
          data: { discountType: null, discountAmount: null, discountPercent: null, discountReason: null, discountApprovalId: null },
        });
      }
      return record;
    });

    return successResponse({ record: result, decision });
  } catch (err: any) {
    console.error('[Complimentary reconciliation]', err);
    if (err.message === 'STAFF_NOT_FOUND') return errorResponse('FORBIDDEN', 'Authenticated user has no active staff profile', 403);
    if (err.message === 'RESERVATION_ROOM_NOT_FOUND') return errorResponse('NOT_FOUND', 'Reservation room was not found for this property', 404);
    if (err.message === 'COMPLIMENTARY_STATE_CHANGED') return errorResponse('CONFLICT', 'The complimentary reservation changed. Refresh the Night Audit wizard.', 409);
    return errorResponse('INTERNAL_ERROR', err.message || 'Unable to reconcile complimentary reservation', 500);
  }
}
