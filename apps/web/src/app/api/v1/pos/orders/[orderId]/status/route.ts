import { NextRequest, NextResponse } from 'next/server';
import prisma, { PosOrderStatus } from '@hotel-pms/db';
import { z } from 'zod';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';

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
      where: { id: orderId }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Optional: Validate state transition. 
    // E.g. Cannot transition from COMPLETED to OPEN.

    const updatedOrder = await prisma.posOrder.update({
      where: { id: orderId },
      data: {
        status,
        notes: reason ? `${order.notes || ''}\nStatus Change Reason: ${reason}`.trim() : order.notes,
        updatedAt: new Date(),
      }
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
