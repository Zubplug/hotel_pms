import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { UnitOfMeasure } from '@hotel-pms/db';
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
    const { fromWarehouseId, toWarehouseId, notes, items, issueToOutlet = false } = body;

    if (!fromWarehouseId || !toWarehouseId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ data: null, error: 'Source, destination, and at least one item are required' }, { status: 400 });
    }

    // Validate both warehouses belong to propertyId
    const warehouses = await prisma.warehouse.findMany({
      where: {
        id: { in: [fromWarehouseId, toWarehouseId] },
        propertyId,
        isActive: true,
      },
      include: { posOutlet: { select: { id: true, name: true } } },
    });

    if (warehouses.length !== 2 && fromWarehouseId !== toWarehouseId) {
      return NextResponse.json({ data: null, error: 'Invalid warehouses' }, { status: 400 });
    } else if (warehouses.length !== 1 && fromWarehouseId === toWarehouseId) {
      return NextResponse.json({ data: null, error: 'Invalid warehouses' }, { status: 400 });
    }

    const destinationWarehouse = warehouses.find(warehouse => warehouse.id === toWarehouseId);
    if (issueToOutlet && !destinationWarehouse?.posOutlet) {
      return NextResponse.json({ data: null, error: 'Issue-to-outlet transfers must target an outlet warehouse' }, { status: 400 });
    }

    const stockItemIds = items.map((item: any) => item.stockItemId);
    const sourceItems = await prisma.stockItem.findMany({
      where: { id: { in: stockItemIds }, propertyId, warehouseId: fromWarehouseId, isActive: true },
      select: { id: true, name: true, baseUnit: true, quantityOnHand: true },
    });
    const sourceById = new Map(sourceItems.map(item => [item.id, item]));
    const seenItemIds = new Set<string>();
    for (const item of items) {
      const quantity = Number(item.quantity);
      const sourceItem = sourceById.get(item.stockItemId);
      if (!sourceItem || seenItemIds.has(item.stockItemId)) {
        return NextResponse.json({ data: null, error: 'Each item must be an active item from the source warehouse, with no duplicates' }, { status: 400 });
      }
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > Number(sourceItem.quantityOnHand)) {
        return NextResponse.json({ data: null, error: `Invalid quantity for ${sourceItem.name}; available stock is ${sourceItem.quantityOnHand}` }, { status: 400 });
      }
      if (!Object.values(UnitOfMeasure).includes(item.unitOfMeasure) || item.unitOfMeasure !== sourceItem.baseUnit) {
        return NextResponse.json({ data: null, error: `Unit for ${sourceItem.name} must be ${sourceItem.baseUnit}` }, { status: 400 });
      }
      seenItemIds.add(item.stockItemId);
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
