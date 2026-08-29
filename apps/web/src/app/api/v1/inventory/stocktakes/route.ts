import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
    const { role, propertyId, isSuperAdmin } = session.user as any;
    if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: any = { propertyId };
    if (status) where.status = status;

    const stocktakes = await prisma.stocktake.findMany({
      where,
      include: {
        warehouse: { select: { name: true } },
        category: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: stocktakes, error: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: null }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
    const { role, propertyId, isSuperAdmin, id: userId } = session.user as any;
    if (!hasInventoryPermission(role, 'inventory.stocktake', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });
    }

    const body = await request.json();
    const { warehouseId, categoryId, notes } = body;

    if (!warehouseId) {
      return NextResponse.json({ error: 'Warehouse ID is required', data: null }, { status: 400 });
    }

    // Generate reference
    const count = await prisma.stocktake.count({ where: { propertyId } });
    const stocktakeRef = `STK-${String(count + 1).padStart(5, '0')}`;

    const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, propertyId, isActive: true } });
    if (!warehouse) {
      return NextResponse.json({ error: 'Warehouse not found', data: null }, { status: 404 });
    }

    if (categoryId) {
      const category = await prisma.inventoryCategory.findFirst({ where: { id: categoryId, propertyId, isActive: true } });
      if (!category) {
        return NextResponse.json({ error: 'Category not found', data: null }, { status: 404 });
      }
    }

    // Get all items that should be part of this snapshot.
    const itemWhere: any = { propertyId, warehouseId, isActive: true };
    if (categoryId) itemWhere.categoryId = categoryId;

    const itemsToCount = await prisma.stockItem.findMany({
      where: itemWhere
    });

    if (itemsToCount.length === 0) {
      return NextResponse.json({ error: 'No active stock items found for the selected criteria', data: null }, { status: 400 });
    }

    const stocktake = await prisma.stocktake.create({
      data: {
        propertyId,
        warehouseId,
        categoryId: categoryId || null,
        stocktakeRef,
        notes,
        status: 'DRAFT',
        createdBy: userId,
        items: {
          create: itemsToCount.map(item => ({
            stockItemId: item.id,
            expectedQty: item.quantityOnHand,
            costAtCount: item.costPrice || 0,
          }))
        }
      },
      include: {
        warehouse: { select: { name: true } },
      }
    });

    return NextResponse.json({ data: stocktake, error: null }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: null }, { status: 500 });
  }
}
