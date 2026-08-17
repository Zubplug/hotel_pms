import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

// POST /api/v1/pos/orders/[orderId]/split
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const { itemIds, userId } = await req.json() as { itemIds: string[]; userId: string };

    if (!itemIds?.length) {
      return NextResponse.json({ error: 'itemIds must be a non-empty array' }, { status: 400 });
    }

    // Load order + items separately (PosCheck not an include key on PosOrder in older schema)
    const order = await prisma.posOrder.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const matchingItems = await prisma.posOrderItem.findMany({
      where: { id: { in: itemIds }, orderId },
    });

    if (!matchingItems.length) {
      return NextResponse.json({ error: 'No matching items found on this order' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingChecks = await tx.posCheck.count({ where: { orderId } });
      const checkNumber = `${order.orderNumber}-CHK${existingChecks + 1}`;
      const checkTotal  = matchingItems.reduce((sum: number, item: any) => sum + Number(item.total), 0);

      const newCheck = await tx.posCheck.create({
        data: {
          orderId,
          checkNumber,
          total:  checkTotal,
          status: 'OPEN',
          businessDate: order.businessDate,
          operationId: `op_chk_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        },
      });

      // Link items to this check
      await tx.posOrderItem.updateMany({
        where: { id: { in: itemIds }, orderId },
        data:  { checkId: newCheck.id },
      });

      return newCheck;
    });

    return NextResponse.json({ data: result, error: null }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/v1/pos/orders/[orderId]/split]', err);
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}

// GET /api/v1/pos/orders/[orderId]/split — all checks on this order
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const checks = await prisma.posCheck.findMany({
      where:   { orderId },
      include: { items: { include: { modifiers: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({ data: checks, error: null });
  } catch (err: any) {
    return NextResponse.json({ data: [], error: err.message }, { status: 500 });
  }
}
