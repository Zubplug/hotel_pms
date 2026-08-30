import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
import { getUserPropertyIds } from '@/lib/property-access';
import { findActiveFrontdeskSession } from '@/lib/frontdesk/active-session';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { getPropertyBusinessDate } from '@/lib/date-utils';

const TRANSITIONS: Record<string, string[]> = {
  'PENDING': ['COLLECTED', 'CANCELLED'],
  'COLLECTED': ['WASHING', 'CANCELLED'],
  'WASHING': ['READY', 'CANCELLED'],
  'READY': ['DELIVERED', 'CANCELLED'],
  'DELIVERED': [], // Cancelled requires formal refund
  'CANCELLED': []
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { id } = await params;
    const body = await req.json();
    const { status, notes, deviceId, version } = body;

    if (!status) return errorResponse('BAD_REQUEST', 'Missing status', 400);

    const order = await prisma.laundryOrder.findUnique({
      where: { id },
      include: { reservation: { include: { folios: { where: { type: 'ROOM', status: 'OPEN' } } } } }
    });

    if (!order) return errorResponse('NOT_FOUND', 'Laundry order not found', 404);
    const property = await prisma.property.findUnique({ where: { id: order.propertyId }, select: { businessDate: true, timezone: true } });
    if (await isNightAuditTransactionLocked(order.propertyId)) {
      return errorResponse('NIGHT_AUDIT_IN_PROGRESS', 'Night audit cutover is in progress. Laundry billing resumes after the new business date is active.', 409);
    }

    const allowedProperties = await getUserPropertyIds(session.user.id);
    if (!allowedProperties.includes(order.propertyId)) {
      return errorResponse('FORBIDDEN', 'Access denied to property', 403);
    }

    const canManage = await hasPermission(session.user.id, 'laundry', 'update', order.propertyId);
    if (!canManage) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);

    const { session: activeFrontdeskSession } = status === 'DELIVERED'
      ? await findActiveFrontdeskSession(session.user.id, order.propertyId, body.frontdeskSessionId)
      : { session: null };
    if (status === 'DELIVERED' && !activeFrontdeskSession) {
      return errorResponse('CONFLICT', 'Open your front desk cashier session before delivering and charging laundry.', 409);
    }

    // Optimistic locking
    if (version !== undefined && order.version !== version) {
        return errorResponse('CONFLICT', 'Order has been modified by someone else', 409);
    }

    // State machine check
    const allowedNextStates = TRANSITIONS[order.status];
    if (!allowedNextStates || !allowedNextStates.includes(status)) {
        return errorResponse('BAD_REQUEST', `Invalid transition from ${order.status} to ${status}`, 400);
    }

    // Cancellation from WASHING or READY requires special permissions
    if (status === 'CANCELLED' && ['WASHING', 'READY'].includes(order.status)) {
        const canCancelLate = await hasPermission(session.user.id, 'laundry', 'delete', order.propertyId);
        if (!canCancelLate) {
            return errorResponse('FORBIDDEN', 'Requires management permission to cancel active laundry', 403);
        }
    }

    const updateData: any = {
      status,
      version: { increment: 1 }
    };

    // Timestamp updates
    if (status === 'COLLECTED') {
      updateData.collectedAt = new Date();
      updateData.collectedBy = session.user.id;
    } else if (status === 'READY') {
      updateData.readyAt = new Date();
    } else if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
      updateData.deliveredBy = session.user.id;
    }

    const updatedOrder = await prisma.$transaction(async (tx: any) => {
      // If DELIVERED, we must post to Folio idempotently
      if (status === 'DELIVERED') {
        if (order.folioItemId) {
            throw new Error('Order is already billed');
        }

        let activeFolio;

        if (order.customerType === 'IN_HOUSE') {
            const reservation = order.reservation;
            if (!reservation) {
                throw new Error('Cannot bill to room: IN_HOUSE order has no associated reservation');
            }
            // Find active folio for the reservation
            activeFolio = reservation.folios.length > 0 
                ? reservation.folios[0] 
                : await tx.folio.create({
                    data: {
                        reservationId: reservation.id,
                        propertyId: order.propertyId,
                        guestId: order.guestId,
                        folioNumber: `FOL-${Date.now()}`,
                        type: 'ROOM',
                        status: 'OPEN',
                        currency: order.currency
                    }
                });
        } else if (order.customerType === 'WALK_IN') {
            // Find an active WALK_IN folio for this guest
            const existingFolios = await tx.folio.findMany({
                where: {
                    propertyId: order.propertyId,
                    guestId: order.guestId,
                    type: 'WALK_IN',
                    status: 'OPEN'
                },
                take: 1
            });

            activeFolio = existingFolios.length > 0
                ? existingFolios[0]
                : await tx.folio.create({
                    data: {
                        propertyId: order.propertyId,
                        guestId: order.guestId,
                        folioNumber: `FOL-${Date.now()}`,
                        type: 'WALK_IN',
                        status: 'OPEN',
                        currency: order.currency
                    }
                });
        } else {
            throw new Error('Invalid customer type for billing');
        }

        const folioItem = await tx.folioItem.create({
            data: {
                folioId: activeFolio.id,
                businessDate: property?.businessDate || getPropertyBusinessDate(property?.timezone),
                type: 'CHARGE',
                source: 'LAUNDRY',
                description: `Laundry Service - ${order.serviceType}`,
                quantity: 1,
                unitAmount: order.totalAmount,
                amount: order.totalAmount,
                currency: order.currency,
                baseAmount: order.totalAmount,
                postedBy: session.user.id,
                deviceId
            }
        });
        
        updateData.folioItemId = folioItem.id;

        let creditApplied = 0;
        const credits = await tx.folioCredit.findMany({
          where: {
            folioId: activeFolio.id,
            propertyId: order.propertyId,
            status: { in: ['AVAILABLE', 'PARTIALLY_APPLIED'] },
            remainingAmount: { gt: 0 }
          },
          orderBy: { createdAt: 'asc' }
        });

        for (const credit of credits) {
          if (creditApplied >= Number(order.totalAmount)) break;
          const remainingCharge = Number(order.totalAmount) - creditApplied;
          const applied = Math.min(remainingCharge, Number(credit.remainingAmount));
          if (applied <= 0) continue;

          const updatedCredit = await tx.folioCredit.updateMany({
            where: { id: credit.id, remainingAmount: { gte: applied } },
            data: {
              remainingAmount: { decrement: applied },
              status: applied >= Number(credit.remainingAmount) ? 'EXHAUSTED' : 'PARTIALLY_APPLIED'
            }
          });
          if (updatedCredit.count !== 1) continue;

          const applicationKey = `CREDIT_APPLICATION:LAUNDRY:${order.id}:${credit.id}`;
          const application = await tx.folioCreditApplication.create({
            data: {
              creditId: credit.id,
              folioId: activeFolio.id,
              amount: applied,
              currency: order.currency,
              source: 'LAUNDRY',
              description: `Applied guest credit to Laundry Service - ${order.serviceType}`,
              idempotencyKey: applicationKey,
              appliedBy: session.user.id,
              deviceId,
              businessDate: property?.businessDate || getPropertyBusinessDate(property?.timezone)
            }
          });

          await tx.financialAuditLog.create({
            data: {
              operationId: applicationKey,
              propertyId: order.propertyId,
              reservationId: activeFolio.reservationId,
              folioId: activeFolio.id,
              guestId: activeFolio.guestId,
              creditId: credit.id,
              creditApplicationId: application.id,
              operationType: 'CREDIT_APPLICATION',
              amount: applied,
              currency: order.currency,
              operatorId: session.user.id,
              deviceId,
              businessDate: property?.businessDate || getPropertyBusinessDate(property?.timezone),
              reason: `Applied guest credit to Laundry Service - ${order.serviceType}`,
              balanceBefore: activeFolio.balance,
              balanceAfter: Number(activeFolio.balance) + Number(order.totalAmount) - creditApplied - applied,
              approvalStatus: 'NOT_REQUIRED',
              idempotencyKey: `audit:${applicationKey}`,
              metadata: { source: 'LAUNDRY_DELIVERY' }
            }
          });
          creditApplied += applied;
        }

        await tx.folio.update({
          where: { id: activeFolio.id },
          data: {
            totalCharges: { increment: order.totalAmount },
            balance: { increment: Number(order.totalAmount) - creditApplied },
            version: { increment: 1 }
          }
        });
      }

      const updated = await tx.laundryOrder.update({
        where: { id },
        data: updateData
      });

      await tx.laundryOrderStatusHistory.create({
        data: {
          laundryOrderId: id,
          previousStatus: order.status,
          newStatus: status,
          changedBy: session.user.id,
          notes,
          deviceId
        }
      });

      return updated;
    });

    return successResponse(updatedOrder);
  } catch (err: any) {
    console.error('[LaundryOrders PATCH]', err);
    if (err.message === 'Order is already billed' || err.message.includes('Cannot bill')) {
        return errorResponse('CONFLICT', err.message, 409);
    }
    return errorResponse('INTERNAL_ERROR', 'Failed to update laundry order', 500);
  }
}
