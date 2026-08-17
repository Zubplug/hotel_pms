import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

// GET /api/v1/pos/floor-plans/[floorPlanId]/tables
// Used by the TableMap component (flat URL — no outletId needed from UI)
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ floorPlanId: string }> }
) {
  try {
    const { floorPlanId } = await params;

    const tables = await prisma.posTable.findMany({
      where: { floorPlanId, isActive: true },
      include: {
        currentOrder: {
          select: {
            id: true,
            status: true,
            orderNumber: true
          }
        }
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ data: tables, error: null });
  } catch (err: any) {
    return NextResponse.json({ data: [], error: err.message }, { status: 500 });
  }
}
