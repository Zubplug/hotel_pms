import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const {
      targetType,
      reservationRoomId,
      orderId,
      compType,       // 'FULL' | 'PARTIAL'
      compAmount,
      reason,
      beneficiaryType,
      beneficiaryStaffId,
      settlementType,
      acknowledgedByStaffId,
    } = body;

    if (!targetType || !reason) {
      return errorResponse('BAD_REQUEST', 'targetType and reason are required', 400);
    }
    if (!acknowledgedByStaffId) {
      return errorResponse('BAD_REQUEST', 'acknowledgedByStaffId is required', 400);
    }

    const idempotencyKey = `comp_${targetType}_${reservationRoomId || orderId}_${Date.now()}`;

    const result = await prisma.$transaction(async (tx) => {
      let propertyId = '';
      let roomId: string | undefined;
      let guestId: string | undefined;
      let operatorId = '';
      let finalCompAmount = Number(compAmount ?? 0);

      if (targetType === 'RESERVATION_ROOM') {
        if (!reservationRoomId) throw new Error('reservationRoomId is required');

        const resRoom = await tx.reservationRoom.findUnique({
          where: { id: reservationRoomId },
          include: { reservation: true },
        });
        if (!resRoom) throw new Error('Reservation room not found');

        propertyId = resRoom.reservation?.propertyId ?? '';
        if (!user.allowedProperties.includes(propertyId)) throw new Error('FORBIDDEN');
        const acknowledgingStaff = await tx.staff.findFirst({ where: { id: acknowledgedByStaffId, propertyAccess: { has: propertyId }, isActive: true }, select: { id: true } });
        if (!acknowledgingStaff) throw new Error('INVALID_ACKNOWLEDGING_STAFF');
        roomId = resRoom.roomId ?? undefined;
        guestId = resRoom.reservation?.primaryGuestId ?? undefined;
        const property = await tx.property.findUnique({ where: { id: propertyId }, select: { organizationId: true, businessDate: true } });
        const operator = await tx.staff.findFirst({ where: { userId: user.id, organizationId: property?.organizationId, isActive: true }, select: { id: true } });
        if (!operator) throw new Error('STAFF_NOT_FOUND');
        operatorId = operator.id;

        if (compType === 'FULL') {
          // Full complimentary: zero out the nightly rate
          finalCompAmount = Number(resRoom.rateAmount ?? 0);
        }

        await tx.complimentaryRecord.create({
          data: {
            propertyId,
            businessDate: property?.businessDate ?? new Date(),
            reference: `COMP_RES_${reservationRoomId}_${Date.now()}`,
            sourceModule: 'FRONT_DESK',
            roomId,
            guestId,
            staffId: beneficiaryStaffId || null,
            operatorId,
            operationId: idempotencyKey,
            grossAmount: finalCompAmount,
            complAmount: finalCompAmount,
            netAmount: 0,
            complType: compType === 'FULL' ? 'FULL' : 'PARTIAL',
            reason,
            notes: JSON.stringify({ acknowledgedByStaffId }),
          },
        });

        return { approvalId: idempotencyKey };

      } else if (targetType === 'POS_ORDER') {
        if (!orderId) throw new Error('orderId is required for POS_ORDER complimentary');

        const order = await tx.posOrder.findUnique({ where: { id: orderId } });
        if (!order) throw new Error('POS order not found');
        propertyId = order.propertyId;
        if (!user.allowedProperties.includes(propertyId)) throw new Error('FORBIDDEN');
        const acknowledgingStaff = await tx.staff.findFirst({ where: { id: acknowledgedByStaffId, propertyAccess: { has: propertyId }, isActive: true }, select: { id: true } });
        if (!acknowledgingStaff) throw new Error('INVALID_ACKNOWLEDGING_STAFF');
        const property = await tx.property.findUnique({ where: { id: propertyId }, select: { organizationId: true } });
        const operator = await tx.staff.findFirst({ where: { userId: user.id, organizationId: property?.organizationId, isActive: true }, select: { id: true } });
        if (!operator) throw new Error('STAFF_NOT_FOUND');
        operatorId = operator.id;

        if (compType === 'FULL') finalCompAmount = Number(order.total ?? 0);

        await tx.complimentaryRecord.create({
          data: {
            propertyId,
            businessDate: order.businessDate ?? new Date(),
            reference: `COMP_POS_${orderId}_${Date.now()}`,
            sourceModule: 'POS',
            posOrderId: orderId,
            staffId: beneficiaryStaffId || null,
            operatorId,
            operationId: idempotencyKey,
            grossAmount: finalCompAmount,
            complAmount: finalCompAmount,
            netAmount: 0,
            complType: compType === 'FULL' ? 'FULL' : 'PARTIAL',
            reason,
            notes: JSON.stringify({ acknowledgedByStaffId }),
          },
        });

        return { approvalId: idempotencyKey };
      } else {
        throw new Error(`Unsupported targetType: ${targetType}`);
      }
    });

    return successResponse({ ...result, status: 'PENDING_NIGHT_AUDIT_VERIFICATION' }, 201);
  } catch (err: any) {
    console.error('[Approvals Complimentary POST]', err);
    if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'No access to this property', 403);
    if (err.message === 'STAFF_NOT_FOUND') return errorResponse('FORBIDDEN', 'Authenticated user has no active staff profile', 403);
    if (err.message === 'INVALID_ACKNOWLEDGING_STAFF') return errorResponse('BAD_REQUEST', 'Acknowledging staff member is not active for this property', 400);
    return errorResponse('INTERNAL_ERROR', err.message || 'Failed to apply complimentary', 500);
  }
}
