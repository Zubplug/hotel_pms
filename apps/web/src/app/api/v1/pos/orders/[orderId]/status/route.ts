import { NextRequest, NextResponse } from 'next/server';
import prisma, { PosOrderStatus } from '@hotel-pms/db';
import { z } from 'zod';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';
import { InventoryService } from '@/lib/inventory/InventoryService';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

const StatusSchema = z.object({
  status: z.nativeEnum(PosOrderStatus),
  reason: z.string().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body = await request.json();
    
    const parsed = StatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const { status, reason } = parsed.data;

    // Verify operator permissions using bearer token
    const authHeader = request.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const payload = await verifyOperatorToken(token);
      if (!payload) {
        return NextResponse.json({ error: 'Invalid operator token' }, { status: 401 });
      }
    }
    const order = await prisma.posOrder.findUnique({
      where: { id: orderId },
      include: { property: true }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const systemCtx: any = {
      organizationId: order.property.organizationId,
      userId: 'SYSTEM',
      role: 'SYSTEM',
      permissions: [],
      propertyIds: [order.propertyId],
      outletIds: [order.outletId]
    };
    if (await isNightAuditTransactionLocked(order.propertyId, order.businessDate)) {
      return NextResponse.json({ error: 'POS order changes are temporarily paused while Night Audit is posting', code: 'NIGHT_AUDIT_IN_PROGRESS' }, { status: 409 });
    }

    // Optional: Validate state transition. 
    // E.g. Cannot transition from COMPLETED to OPEN.

    if (status === 'VOIDED' && order.status !== 'VOIDED') {
      try {
        await InventoryService.restoreSale(systemCtx, orderId, 'system', `op_restore_voided_${orderId}`);
      } catch (inventoryError) {
        console.error(`[Inventory Error] Failed to restore stock for POS ${status} ${orderId}:`, inventoryError);
        return NextResponse.json({ error: 'Order status was not changed because inventory restoration failed' }, { status: 409 });
      }
    }

    const updatedOrder = await prisma.posOrder.update({
      where: { id: orderId },
      data: {
        status,
        notes: reason ? `${order.notes || ''}\nStatus Change Reason: ${reason}`.trim() : order.notes,
        updatedAt: new Date(),
      }
    });

    if (status === 'CLOSED' && order.status !== 'CLOSED') {
      try {
        await InventoryService.postSale(systemCtx, orderId, 'system', `op_sale_status_${orderId}`);
      } catch (inventoryError) {
        console.error(`[Inventory Error] Failed to deduct stock for POS Order ${orderId}:`, inventoryError);
      }
    }
    return NextResponse.json({ data: updatedOrder });
  } catch (error: any) {
    console.error(`[PATCH /api/v1/pos/orders/[orderId]/status]`, error);
    return NextResponse.json(
      { error: 'Failed to update order status' },
      { status: 500 }
    );
  }
}
