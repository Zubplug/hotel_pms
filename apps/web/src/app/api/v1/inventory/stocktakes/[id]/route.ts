import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
    const { role, propertyId, isSuperAdmin } = session.user as any;
    if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });
    }

    const stocktake = await prisma.stocktake.findUnique({
      where: { id: params.id, propertyId },
      include: {
        warehouse: { select: { name: true } },
        category: { select: { name: true } },
        items: {
          include: {
            stockItem: { select: { name: true, sku: true, baseUnit: true } }
          },
          orderBy: { stockItem: { name: 'asc' } }
        }
      }
    });

    if (!stocktake) {
      return NextResponse.json({ error: 'Not found', data: null }, { status: 404 });
    }

    return NextResponse.json({ data: stocktake, error: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: null }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
    const { role, propertyId, isSuperAdmin } = session.user as any;
    if (!hasInventoryPermission(role, 'inventory.stocktake', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });
    }

    const body = await request.json();
    const { counts } = body; // Array of { itemId: string, countedQty: number | null }
    if (!Array.isArray(counts)) {
      return NextResponse.json({ error: 'Counts must be an array', data: null }, { status: 400 });
    }

    // Ensure it's in COUNTING state
    const stocktake = await prisma.stocktake.findUnique({
      where: { id: params.id, propertyId }
    });

    if (!stocktake || stocktake.status !== 'COUNTING') {
      return NextResponse.json({ error: 'Stocktake must be in COUNTING status to update counts', data: null }, { status: 400 });
    }

    const invalidCount = counts.find((count: any) =>
      typeof count.itemId !== 'string' ||
      (count.countedQty !== null && (!Number.isFinite(Number(count.countedQty)) || Number(count.countedQty) < 0))
    );
    if (invalidCount) {
      return NextResponse.json({ error: 'Every count must be a non-negative number or blank', data: null }, { status: 400 });
    }

    // Update each item in a transaction
    await prisma.$transaction(
      counts.map((c: any) => 
        prisma.stocktakeItem.updateMany({
          where: { id: c.itemId, stocktakeId: params.id },
          data: { countedQty: c.countedQty }
        })
      )
    );

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: null }, { status: 500 });
  }
}
