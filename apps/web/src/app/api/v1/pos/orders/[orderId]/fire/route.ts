import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';

// POST /api/v1/pos/orders/[orderId]/fire
// Marks selected order items as SENT to kitchen and creates a PosKot record.
// The C# KotPrintService polls for printStatus = 'QUEUED' and handles physical printing.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Operator token required' }, { status: 401 });
    }

    const payload = await verifyOperatorToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid or expired operator token' }, { status: 401 });
    }

    const { itemIds } = await req.json() as { itemIds: string[] };
    if (!itemIds?.length) {
      return NextResponse.json({ error: 'itemIds must be a non-empty array' }, { status: 400 });
    }

    // Verify the order exists and the items belong to it
    const order = await prisma.posOrder.findUnique({
      where: { id: orderId },
      include: {
        items: {
          where: { id: { in: itemIds } },
          include: { modifiers: true },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (!order.items.length) {
      return NextResponse.json({ error: 'No matching items found on this order' }, { status: 400 });
    }

    if (order.outletId !== payload.outletId || order.propertyId !== payload.propertyId) {
      return NextResponse.json({ error: 'Context mismatch: token does not match order context' }, { status: 403 });
    }

    const kot = await prisma.$transaction(async (tx) => {
      // Generate a human-readable KOT number scoped to the outlet
      const kotCount = await tx.posKot.count({ where: { outletId: order.outletId } });
      const kotNumber = `KOT-${String(kotCount + 1).padStart(4, '0')}`;

      // Create the KOT — PosKot.items is a reverse relation via kotId on PosOrderItem
      const newKot = await tx.posKot.create({
        data: {
          orderId,
          outletId:     order.outletId,
          deviceId:     payload.deviceId,
          createdBy:    payload.staffId,
          kotNumber,
          status: 'PENDING',
          printStatus: 'QUEUED',
          attemptCount: 0,
          businessDate: order.businessDate,
        },
      });

      // Link the order items to this KOT and mark them as SENT
      await tx.posOrderItem.updateMany({
        where: { id: { in: itemIds }, orderId },
        data: {
          kitchenStatus:   'SENT',
          sentToKitchenAt: new Date(),
          kotId:           newKot.id,
        } as any, // kitchenStatus is String? — cast needed until prisma types refresh
      });

      // Return KOT with its newly linked items
      return tx.posKot.findUnique({
        where: { id: newKot.id },
        include: {
          items: { include: { modifiers: true } },
        },
      });
    });

    return NextResponse.json({ data: kot, error: null }, { status: 201 });
  } catch (err: any) {
    console.error('[POST /api/v1/pos/orders/[orderId]/fire]', err);
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}
