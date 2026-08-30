import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { UnitOfMeasure } from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { InventoryService } from '@/lib/inventory/InventoryService';
import { resolveStockUnitConversion } from '@/lib/inventory/UnitConversionService';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

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

    const { staffId } = session.user as any;
    const outletHeadFilter = String(role).toUpperCase() === 'OUTLET_HEAD' && staffId
      ? { toWarehouse: { posOutlet: { staffAccess: { some: { staffId } } } } }
      : {};
    const transfers = await prisma.stockTransfer.findMany({
      where: { propertyId, ...outletHeadFilter },
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

    const { role, propertyId, isSuperAdmin, id: userId, staffId } = session.user as any;
    const normalizedRole = String(role || '').toUpperCase();

    if (!hasInventoryPermission(role, 'inventory.transfer', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { fromWarehouseId, toWarehouseId, notes, items, issueToOutlet = false } = body;

    if (!fromWarehouseId || !toWarehouseId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ data: null, error: 'Source, destination, and at least one item are required' }, { status: 400 });
    }

    if (await isNightAuditTransactionLocked(propertyId)) {
      return NextResponse.json({ data: null, error: 'Stock transfers cannot be created while Night Audit is posting. Retry after the new business date is active.', code: 'NIGHT_AUDIT_IN_PROGRESS' }, { status: 409 });
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
    const sourceWarehouse = warehouses.find(warehouse => warehouse.id === fromWarehouseId);
    if (issueToOutlet && !destinationWarehouse?.posOutlet) {
      return NextResponse.json({ data: null, error: 'Issue-to-outlet transfers must target an outlet warehouse' }, { status: 400 });
    }
    if (issueToOutlet && sourceWarehouse?.posOutlet) {
      return NextResponse.json({ data: null, error: 'Issue-to-outlet transfers must start from a warehouse, not another outlet' }, { status: 400 });
    }
    if (String(role).toUpperCase() === 'OUTLET_HEAD') {
      if (!issueToOutlet || !destinationWarehouse?.posOutlet || !staffId) {
        return NextResponse.json({ data: null, error: 'Outlet heads can only request stock for their assigned outlet' }, { status: 403 });
      }
      const outletAccess = await prisma.staffPosOutletAccess.findUnique({
        where: { staffId_outletId: { staffId, outletId: destinationWarehouse.posOutlet.id } },
      });
      if (!outletAccess) {
        return NextResponse.json({ data: null, error: 'You are not assigned to this outlet' }, { status: 403 });
      }
    }

    const autoPostOutletIssue = issueToOutlet && ['STOCK_KEEPER', 'STOCK_MANAGER'].includes(normalizedRole);

    const stockItemIds = items.map((item: any) => item.stockItemId);
    const sourceItems = await prisma.stockItem.findMany({
      where: { id: { in: stockItemIds }, propertyId, warehouseId: fromWarehouseId, isActive: true },
      select: { id: true, name: true, baseUnit: true, quantityOnHand: true, stockUnits: true },
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
      if (!Object.values(UnitOfMeasure).includes(item.unitOfMeasure)) return NextResponse.json({ data: null, error: `Invalid unit for ${sourceItem.name}` }, { status: 400 });
      const conversion = item.unitOfMeasure === sourceItem.baseUnit ? 1 : Number(sourceItem.stockUnits.find((unit: any) => unit.unit === item.unitOfMeasure)?.unitsInBase || 0);
      if (conversion <= 0) return NextResponse.json({ data: null, error: `No conversion configured from ${item.unitOfMeasure} to ${sourceItem.baseUnit} for ${sourceItem.name}` }, { status: 400 });
      item.baseQuantity = quantity * conversion;
      if (item.baseQuantity > Number(sourceItem.quantityOnHand)) return NextResponse.json({ data: null, error: `Invalid quantity for ${sourceItem.name}; available stock is ${sourceItem.quantityOnHand} ${sourceItem.baseUnit}` }, { status: 400 });
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
        status: autoPostOutletIssue ? 'APPROVED' : 'DRAFT',
        ...(autoPostOutletIssue && { approvedBy: userId, approvedAt: new Date() }),
        requestedBy: userId,
        items: {
          create: items.map((item: any) => ({
            stockItemId: item.stockItemId,
            quantity: item.quantity,
            unitOfMeasure: item.unitOfMeasure,
            baseQuantity: item.baseQuantity,
            notes: item.notes,
          }))
        }
      },
      include: {
        items: true,
      }
    });

    if (autoPostOutletIssue) {
      const result = await InventoryService.postTransfer(transfer.id, userId, crypto.randomUUID());
      return NextResponse.json({ data: (result as any).transfer || transfer, error: null });
    }

    return NextResponse.json({ data: transfer, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
