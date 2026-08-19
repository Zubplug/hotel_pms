import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import prisma from '@hotel-pms/db';

// GET /api/v1/pos/sessions/[id]/open-orders
// Returns all SUBMITTED or IN_SERVICE orders for a session.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;

    const orders = await prisma.posOrder.findMany({
      where: {
        sessionId,
        status: { in: ['SUBMITTED', 'IN_SERVICE'] },
      },
      include: {
        table: { select: { id: true, name: true } },
        serverStaff: { select: { id: true, firstName: true, lastName: true } },
        items: { select: { id: true } },
        productionBatches: {
          orderBy: { firedAt: 'asc' },
          take: 1,
          select: { firedAt: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const result = orders.map((o: any) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      paymentStatus: o.paymentStatus,
      tableId: o.tableId,
      tableNumber: o.tableNumber,
      tableName: o.table?.name ?? null,
      serverStaff: o.serverStaff
        ? { id: o.serverStaff.id, name: `${o.serverStaff.firstName} ${o.serverStaff.lastName}` }
        : null,
      guestCount: o.guestCount,
      itemCount: o.items.length,
      subtotal: o.subtotal,
      taxAmount: o.taxAmount,
      total: o.total,
      serviceCharge: o.serviceCharge,
      oldestBatchFiredAt: o.productionBatches[0]?.firedAt ?? null,
      createdAt: o.createdAt,
    }));

    return NextResponse.json({ data: result, error: null });
  } catch (err: any) {
    console.error('[GET /api/v1/pos/sessions/[id]/open-orders]', err);
    return NextResponse.json({ data: [], error: err.message }, { status: 500 });
  }
}
