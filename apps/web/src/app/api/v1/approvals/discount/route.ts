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
      folioId,
      targetFolioItemId,
      orderId,
      discountType,
      discountAmount,
      discountPercent,
      reason,
      acknowledgedByStaffId,
    } = body;

    if (!targetType || !reason) {
      return errorResponse('BAD_REQUEST', 'targetType and reason are required', 400);
    }
    if (!acknowledgedByStaffId) {
      return errorResponse('BAD_REQUEST', 'acknowledgedByStaffId is required', 400);
    }

    const idempotencyKey = body.idempotencyKey || `disc_${targetType}_${reservationRoomId || folioId || orderId}_${Date.now()}`;

    const result = await prisma.$transaction(async (tx) => {
      let propertyId = '';
      let currency = 'NGN';

      if (targetType === 'RESERVATION_ROOM') {
        if (!reservationRoomId) throw new Error('reservationRoomId is required for RESERVATION_ROOM discount');

        const resRoom = await tx.reservationRoom.findUnique({
          where: { id: reservationRoomId },
          include: { reservation: true },
        });
        if (!resRoom) throw new Error('Reservation room not found');

        propertyId = resRoom.reservation?.propertyId ?? '';
        if (!user.allowedProperties.includes(propertyId)) throw new Error('FORBIDDEN');
        const acknowledgingStaff = await tx.staff.findFirst({ where: { id: acknowledgedByStaffId, propertyAccess: { has: propertyId }, isActive: true }, select: { id: true } });
        if (!acknowledgingStaff) throw new Error('INVALID_ACKNOWLEDGING_STAFF');
        currency = resRoom.currency ?? 'NGN';

        if (!['PERCENTAGE', 'FIXED_AMOUNT'].includes(discountType)) throw new Error('INVALID_DISCOUNT_TYPE');
        const amount = Number(discountAmount ?? 0);
        const percent = Number(discountPercent ?? 0);
        if (discountType === 'FIXED_AMOUNT' && (!Number.isFinite(amount) || amount <= 0 || amount > Number(resRoom.rateAmount))) {
          throw new Error('INVALID_DISCOUNT_AMOUNT');
        }
        if (discountType === 'PERCENTAGE' && (!Number.isFinite(percent) || percent <= 0 || percent > 100)) {
          throw new Error('INVALID_DISCOUNT_PERCENT');
        }

        const approval = await tx.approvalRequest.create({
          data: {
            propertyId,
            type: 'DISCOUNT',
            status: 'PENDING',
            executionStatus: 'NOT_APPLIED',
            requestedBy: user.id,
            amount: discountType === 'FIXED_AMOUNT' ? amount : 0,
            currency,
            reason,
            details: body,
            snapshot: {
              targetType: 'RESERVATION_ROOM',
              reservationRoomId,
              originalRate: Number(resRoom.rateAmount),
              discountType,
              discountAmount: discountType === 'FIXED_AMOUNT' ? amount : 0,
              discountPercent: discountType === 'PERCENTAGE' ? percent : 0,
              reason,
            },
            idempotencyKey,
          },
        });

        return { approvalId: approval.id };

      } else if (targetType === 'FOLIO_ITEM') {
        if (!folioId) throw new Error('folioId is required for FOLIO_ITEM discount');
        const amount = Number(discountAmount ?? 0);
        if (amount <= 0) throw new Error('Discount amount must be positive');

        const folio = await tx.folio.findUnique({ where: { id: folioId } });
        if (!folio) throw new Error('Folio not found');
        propertyId = folio.propertyId;
        if (!user.allowedProperties.includes(propertyId)) throw new Error('FORBIDDEN');
        const acknowledgingStaff = await tx.staff.findFirst({ where: { id: acknowledgedByStaffId, propertyAccess: { has: propertyId }, isActive: true }, select: { id: true } });
        if (!acknowledgingStaff) throw new Error('INVALID_ACKNOWLEDGING_STAFF');
        currency = folio.currency ?? 'NGN';

        const approval = await tx.approvalRequest.create({
          data: {
            propertyId,
            type: 'DISCOUNT',
            status: 'PENDING',
            executionStatus: 'NOT_APPLIED',
            requestedBy: user.id,
            amount,
            currency,
            reason,
            details: body,
            snapshot: { ...body, targetType: 'FOLIO_ITEM', folioId, targetFolioItemId },
            idempotencyKey,
          },
        });

        return { approvalId: approval.id };

      } else {
        throw new Error(`Unsupported targetType: ${targetType}`);
      }
    });

    return successResponse({ ...result, status: 'PENDING_NIGHT_AUDIT_APPROVAL' }, 201);
  } catch (err: any) {
    console.error('[Approvals Discount POST]', err);
    if (err.message === 'FORBIDDEN') return errorResponse('FORBIDDEN', 'No access to this property', 403);
    if (['INVALID_DISCOUNT_TYPE', 'INVALID_DISCOUNT_AMOUNT', 'INVALID_DISCOUNT_PERCENT'].includes(err.message)) {
      return errorResponse('BAD_REQUEST', err.message, 400);
    }
    if (err.message === 'INVALID_ACKNOWLEDGING_STAFF') {
      return errorResponse('BAD_REQUEST', 'Acknowledging staff member is not active for this property', 400);
    }
    return errorResponse('INTERNAL_ERROR', err.message || 'Failed to apply discount', 500);
  }
}
