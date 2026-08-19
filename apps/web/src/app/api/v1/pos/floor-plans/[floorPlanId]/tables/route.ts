import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export const dynamic = 'force-dynamic';

// GET /api/v1/pos/floor-plans/[floorPlanId]/tables
// Used by the TableMap component (no auth required — floor plan data is non-sensitive)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ floorPlanId: string }> }
) {
  try {
    const { floorPlanId } = await params;
    console.log('GET tables called for floorPlanId:', floorPlanId);

    const tables = await prisma.posTable.findMany({
      where: { floorPlanId, isActive: true },
      orderBy: { name: 'asc' },
    });

    const activeOrderIds = tables.map((t) => t.currentOrderId).filter(Boolean) as string[];

    let activeOrders: any[] = [];
    if (activeOrderIds.length > 0) {
      activeOrders = await prisma.posOrder.findMany({
        where: { id: { in: activeOrderIds } },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          total: true,
          guestCount: true,
          serverStaff: {
            select: { firstName: true, lastName: true }
          }
        }
      });
    }

    const tablesWithOrder = tables.map(table => ({
      ...table,
      currentOrder: table.currentOrderId ? activeOrders.find(o => o.id === table.currentOrderId) : null
    }));

    console.log('GET tables returning count:', tablesWithOrder.length);
    return NextResponse.json({ data: tablesWithOrder, error: null });
  } catch (err: any) {
    console.error('GET tables error:', err);
    return NextResponse.json({ data: [], error: err.message }, { status: 500 });
  }
}
