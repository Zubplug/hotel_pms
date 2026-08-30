import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';
import { z } from 'zod';
import { InventoryService } from '@/lib/inventory/InventoryService';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

const PaymentSchema = z.object({
  method: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('NGN'),
  checkId: z.string().nullish(),
  inventoryOverrideApprovalId: z.string().uuid().nullish(),
});

// POST /api/v1/pos/orders/[orderId]/pay
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body = await req.json();
    
    const parsed = PaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payment data' }, { status: 400 });
    }

    const { method, amount, currency, checkId, inventoryOverrideApprovalId } = parsed.data;

    // Payment posting must always be tied to an active operator session.
    let sessionId = null;
    let staffId = null;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Operator token required' }, { status: 401 });
    }
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const payload = await verifyOperatorToken(token);
      if (!payload) {
        return NextResponse.json({ error: 'Invalid operator token' }, { status: 401 });
      }
      sessionId = payload.sessionId;
      staffId = payload.staffId;
    }

    const order = await prisma.posOrder.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (await isNightAuditTransactionLocked(order.propertyId, order.businessDate)) {
      return NextResponse.json({ error: 'Night audit is in progress. New POS transactions are temporarily paused.' }, { status: 409 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: 'An open POS till is required before posting a payment.' }, { status: 409 });
    }
    if (order.sessionId && order.sessionId !== sessionId) {
      return NextResponse.json({ error: 'This order belongs to a different POS till.' }, { status: 403 });
    }
    const activePosSession = await prisma.posSession.findFirst({
      where: { id: sessionId, propertyId: order.propertyId, outletId: order.outletId, status: 'OPEN', controlStatus: 'OPEN' },
      select: { id: true },
    });
    if (!activePosSession) {
      return NextResponse.json({ error: 'This POS till is closed or pending approval. Open an active till to continue.' }, { status: 409 });
    }

    const result = await prisma.$transaction(async (tx: any) => {
      // Create payment
      const payment = await tx.posPayment.create({
        data: {
          orderId,
          method: method as any,
          amount,
          currency,
          status: 'CONFIRMED',
          businessDate: order.businessDate,
          operationId: `op_pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          sessionId: sessionId || undefined,
          processedById: staffId || undefined,
        }
      });

      // Check if order is fully paid
      const allOrderPayments = await tx.posPayment.aggregate({
        where: { orderId, status: 'CONFIRMED' },
        _sum: { amount: true }
      });
      const orderPaidSoFar = Number(allOrderPayments._sum.amount || 0);
      
      let updatedOrder: typeof order = order;
      if (orderPaidSoFar >= Number(order.total)) {
        await InventoryService.commitSaleInTransaction(tx, orderId, staffId || 'system', `op_sale_${orderId}_${payment.id}`, inventoryOverrideApprovalId || undefined);
        updatedOrder = await tx.posOrder.update({
          where: { id: orderId },
          data: {
            status: 'CLOSED',
            paymentStatus: 'PAID',
            closedAt: new Date(),
          }
        });

        // Release the table if applicable
        if (order.tableId) {
          await tx.posTable.update({
            where: { id: order.tableId },
            data: { currentOrderId: null }
          });
        }
      } else if (orderPaidSoFar > 0) {
        // Partially paid
        await tx.posOrder.update({
          where: { id: orderId },
          data: { paymentStatus: 'PARTIALLY_PAID' }
        });
      }

      return { payment, order: updatedOrder };
    });

    return NextResponse.json({ data: result, error: null }, { status: 201 });
  } catch (err: any) {
    console.error(`[POST /api/v1/pos/orders/[orderId]/pay]`, err);
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}
