import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';
import { successResponse, errorResponse } from '@/lib/api-response';

// POST /api/v1/room-service/orders/[orderId]/reject
// Operator declines a SUBMITTED room service order.
// The order is voided; the guest tracking page surfaces the rejection reason.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return errorResponse('UNAUTHORIZED', 'Operator authorization token required', 401);
    }

    const payload = await verifyOperatorToken(token);
    if (!payload) {
      return errorResponse('UNAUTHORIZED', 'Invalid or expired operator token', 401);
    }

    const { staffId, propertyId } = payload;

    const body = await req.json().catch(() => ({}));
    const reason: string = body.reason || 'Order declined by kitchen staff. Please contact the front desk.';

    const order = await prisma.posOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        propertyId: true,
        status: true,
        orderNumber: true,
        tableNumber: true,
      },
    });

    if (!order) {
      return errorResponse('NOT_FOUND', 'Room service order not found', 404);
    }

    if (order.propertyId !== propertyId) {
      return errorResponse('FORBIDDEN', 'Order belongs to a different property', 403);
    }

    // Only SUBMITTED orders can be rejected — anything already in progress is too late
    if (order.status !== 'SUBMITTED') {
      return errorResponse(
        'INVALID_STATE',
        `Cannot reject an order that is already ${order.status}. Only SUBMITTED orders may be declined.`,
        400
      );
    }

    await prisma.posOrder.update({
      where: { id: orderId },
      data: {
        status: 'CANCELLED',
        notes: `[REJECTED by staff ${staffId}]: ${reason}`,
        updatedAt: new Date(),
      },
    });

    return successResponse({
      orderId,
      status: 'CANCELLED',
      reason,
      message: 'Order rejected. The guest tracking page will reflect this immediately.',
    });
  } catch (err: any) {
    console.error('[POST /api/v1/room-service/orders/[orderId]/reject]', err);
    return errorResponse('INTERNAL_ERROR', err?.message || 'Failed to reject order', 500);
  }
}
