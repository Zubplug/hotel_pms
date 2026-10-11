import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET /api/v1/room-service/orders/[orderId]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const order = await prisma.posOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { modifiers: true },
        },
        productionBatches: {
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!order) {
      return errorResponse('NOT_FOUND', 'Order not found', 404);
    }

    // Determine high-level guest-facing status
    let guestStatus = 'PLACED';
    let statusLabel = 'Order Received';
    let statusDescription = 'Your order has been received and sent to the culinary team.';

    if (order.status === 'IN_SERVICE') {
      const anyBatchPreparing = order.productionBatches.some(
        b => b.status === 'PREPARING' || b.status === 'ACKNOWLEDGED'
      );
      const allBatchesReady = order.productionBatches.length > 0 && order.productionBatches.every(
        b => b.status === 'READY' || b.status === 'COMPLETED'
      );

      if (allBatchesReady) {
        guestStatus = 'OUT_FOR_DELIVERY';
        statusLabel = 'On Its Way to Your Room';
        statusDescription = 'Your meal is plated and being brought up to your room.';
      } else if (anyBatchPreparing) {
        guestStatus = 'PREPARING';
        statusLabel = 'Cooking in the Kitchen';
        statusDescription = 'Our chefs are actively preparing your fresh order.';
      } else {
        guestStatus = 'ACKNOWLEDGED';
        statusLabel = 'Order Accepted';
        statusDescription = 'Staff has acknowledged your order and queued it for preparation.';
      }
    } else if (order.status === 'CLOSED') {
      guestStatus = 'DELIVERED';
      statusLabel = 'Delivered & Enjoy!';
      statusDescription = 'Your order has been delivered. Bon appétit!';
    } else if (order.status === 'CANCELLED' || order.status === 'VOIDED') {
      guestStatus = 'CANCELLED';
      statusLabel = 'Order Cancelled';
      statusDescription = 'This order was cancelled. Please contact room service if this was unexpected.';
    }

    return successResponse({
      id: order.id,
      orderNumber: order.orderNumber,
      tableNumber: order.tableNumber,
      displayName: order.displayName,
      status: order.status,
      paymentStatus: order.paymentStatus,
      guestStatus,
      statusLabel,
      statusDescription,
      subtotal: Number(order.subtotal),
      taxAmount: Number(order.taxAmount),
      total: Number(order.total),
      notes: order.notes,
      createdAt: order.createdAt,
      items: order.items.map(item => ({
        id: item.id,
        productName: item.productName,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        total: Number(item.total),
        modifiers: item.modifiers.map(m => m.name),
      })),
      batches: order.productionBatches.map(b => ({
        id: b.id,
        station: b.station,
        status: b.status,
        batchNumber: b.batchNumber,
      })),
    });
  } catch (err: any) {
    console.error('[GET /api/v1/room-service/orders/[orderId]]', err);
    return errorResponse('INTERNAL_ERROR', err?.message || 'Failed to fetch order status', 500);
  }
}
