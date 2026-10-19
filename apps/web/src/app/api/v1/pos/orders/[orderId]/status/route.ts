/* eslint-disable @typescript-eslint/no-explicit-any */
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

    // Operator credentials are mandatory for every status mutation. A missing
    // token must never be treated as a system request.
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing operator token' }, { status: 401 });
    }
    const token = authHeader.slice(7).trim();
    const payload = await verifyOperatorToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid operator token' }, { status: 401 });
    }
    const order = await prisma.posOrder.findUnique({
      where: { id: orderId },
      include: { property: true, poolEntries: { select: { id: true, status: true } } }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (payload.propertyId !== order.propertyId || payload.outletId !== order.outletId) {
      return NextResponse.json({ error: 'Operator is not authorized for this order' }, { status: 403 });
    }

    if (await isNightAuditTransactionLocked(order.propertyId, order.businessDate)) {
      return NextResponse.json({ error: 'POS order changes are temporarily paused while Night Audit is posting', code: 'NIGHT_AUDIT_IN_PROGRESS' }, { status: 409 });
    }

    // Optional: Validate state transition. 
    // E.g. Cannot transition from COMPLETED to OPEN.

    const updatedOrder = await prisma.$transaction(async (tx: any) => {
      if (status === 'CLOSED' && order.status !== 'CLOSED') {
        await InventoryService.commitSaleInTransaction(tx, orderId, payload.staffId, `op_sale_status_${orderId}`);
      }

      if (status === 'VOIDED' && order.status !== 'VOIDED') {
        await InventoryService.restoreSale(orderId, payload.staffId, `op_restore_voided_${orderId}`, tx);
      }

      const updated = await tx.posOrder.update({
        where: { id: orderId },
        data: {
          status,
          notes: reason ? `${order.notes || ''}\nStatus Change Reason: ${reason}`.trim() : order.notes,
          updatedAt: new Date(),
        }
      });

      // Pool admissions are access-control records linked to the POS sale. A
      // void/cancellation must revoke the admission atomically with the sale.
      if (['VOIDED', 'CANCELLED'].includes(status) && order.poolEntries.length > 0) {
        await tx.poolEntry.updateMany({
          where: { id: { in: order.poolEntries.map((entry) => entry.id) }, status: { not: 'COMPLETED' } },
          data: { status: 'CANCELLED' },
        });
      }

      return updated;
    });
    return NextResponse.json({ data: updatedOrder });
  } catch (error: any) {
    console.error(`[PATCH /api/v1/pos/orders/[orderId]/status]`, error);
    return NextResponse.json(
      { error: 'Failed to update order status' },
      { status: 500 }
    );
  }
}
