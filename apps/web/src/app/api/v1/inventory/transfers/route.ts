import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, propertyId, isSuperAdmin } = session.user as any;

    if (!hasInventoryPermission(role, 'inventory.transfer', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const transfers = await prisma.stockTransfer.findMany({
      where: { propertyId },
      include: {
        fromWarehouse: { select: { name: true } },
        toWarehouse: { select: { name: true } },
        _count: { select: { items: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: transfers, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, propertyId, isSuperAdmin, id: userId } = session.user as any;

    if (!hasInventoryPermission(role, 'inventory.transfer', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { fromWarehouseId, toWarehouseId, notes, items } = body;

    // Validate both warehouses belong to propertyId
    const warehouses = await prisma.warehouse.findMany({
      where: {
        id: { in: [fromWarehouseId, toWarehouseId] },
        propertyId,
      }
    });

    if (warehouses.length !== 2 && fromWarehouseId !== toWarehouseId) {
      return NextResponse.json({ data: null, error: 'Invalid warehouses' }, { status: 400 });
    } else if (warehouses.length !== 1 && fromWarehouseId === toWarehouseId) {
      return NextResponse.json({ data: null, error: 'Invalid warehouses' }, { status: 400 });
    }

    // Auto-generate transferRef (TRF-00001) - naive implementation
    const count = await prisma.stockTransfer.count({ where: { propertyId } });
    const transferRef = `TRF-${String(count + 1).padStart(5, '0')}`;

    const transfer = await prisma.stockTransfer.create({
      data: {
        propertyId,
        transferRef,
        fromWarehouseId,
        toWarehouseId,
        notes,
        status: 'DRAFT',
        requestedBy: userId,
        items: {
          create: items.map((item: any) => ({
            stockItemId: item.stockItemId,
            quantity: item.quantity,
            unitOfMeasure: item.unitOfMeasure,
            notes: item.notes,
          }))
        }
      },
      include: {
        items: true,
      }
    });

    return NextResponse.json({ data: transfer, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
