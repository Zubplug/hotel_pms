import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import prisma from '@hotel-pms/db';
import { ProductionStation } from '@hotel-pms/db';

// GET /api/v1/pos/outlets/[outletId]/production-batches?station=KITCHEN
// Returns PENDING and ACKNOWLEDGED batches for the given station (KDS/Bar display).
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ outletId: string }> }
) {
  try {
    const { outletId } = await params;
    const { searchParams } = new URL(req.url);
    const station = searchParams.get('station') as ProductionStation | null;

    if (!station) {
      return NextResponse.json({ error: 'station query param is required' }, { status: 400 });
    }

    const validStations: ProductionStation[] = ['KITCHEN', 'BAR', 'DIRECT', 'NONE'];
    if (!validStations.includes(station)) {
      return NextResponse.json({ error: `Invalid station. Must be one of: ${validStations.join(', ')}` }, { status: 400 });
    }

    const batches = await prisma.posProductionBatch.findMany({
      where: {
        station,
        status: { in: ['PENDING', 'ACKNOWLEDGED'] },
        order: { outletId },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            tableNumber: true,
            table: { select: { name: true } },
            guestCount: true,
          },
        },
        items: true,
      },
      orderBy: { firedAt: 'asc' },
    });

    const result = batches.map((b: any) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      station: b.station,
      status: b.status,
      firedAt: b.firedAt,
      order: {
        id: b.order.id,
        orderNumber: b.order.orderNumber,
        tableNumber: b.order.tableNumber,
        tableName: b.order.table?.name ?? null,
        guestCount: b.order.guestCount,
      },
      items: b.items.map((i: any) => ({
        id: i.id,
        productName: i.productName,
        quantity: i.quantity,
        modifiers: i.modifiers,
        course: i.course,
      })),
    }));

    return NextResponse.json({ data: result, error: null });
  } catch (err: any) {
    console.error('[GET /api/v1/pos/outlets/[outletId]/production-batches]', err);
    return NextResponse.json({ data: [], error: err.message }, { status: 500 });
  }
}
