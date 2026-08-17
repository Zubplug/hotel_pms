import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';
import { z } from 'zod';

const PaymentSchema = z.object({
  method: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('NGN'),
  checkId: z.string().optional(),
});

// POST /api/v1/pos/orders/[orderId]/pay
export async function POST(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  try {
    const { orderId } = params;
    const body = await req.json();
    
    const parsed = PaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payment data' }, { status: 400 });
    }

    const { method, amount, currency, checkId } = parsed.data;

    // Optional: verify token
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const payload = await verifyOperatorToken(token);
      if (!payload) {
        return NextResponse.json({ error: 'Invalid operator token' }, { status: 401 });
      }
    }

    const order = await prisma.posOrder.findUnique({
      where: { id: orderId }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
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
