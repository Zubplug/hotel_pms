import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { UnitOfMeasure } from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { InventoryService } from '@/lib/inventory/InventoryService';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { requireInventoryAccess } from '@/lib/auth/inventory-access';

export const dynamic = 'force-dynamic';

/* ─── helper ──────────────────────────────────────────────────────────────── */
const MAIN_WAREHOUSE_ROLES = new Set(['STOCK_MANAGER', 'STOCK_KEEPER', 'FNB_MANAGER', 'OUTLET_HEAD']);
const STOCK_STAFF_ROLES    = new Set(['STOCK_MANAGER', 'STOCK_KEEPER']);
const TOP_MANAGEMENT_ROLES = new Set(['CEO', 'SUPER_ADMIN', 'MANAGER', 'DIRECTOR', 'GENERAL_MANAGER', 'ACCOUNTANT', 'GENERAL_CASHIER']);

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, isSuperAdmin, staffId } = session.user as any;
    const ctx = await requireInventoryAccess(session.user.id);
    if (!hasInventoryPermission(role, 'inventory.transfer', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const normalizedRole = String(role || '').toUpperCase();

    // FNB_MANAGER: only see transfers going to their outlet(s)
    // OUTLET_HEAD: only see transfers going to their assigned outlet
    const outletHeadFilter = normalizedRole === 'OUTLET_HEAD' && staffId
      ? { toWarehouse: { posOutlet: { staffAccess: { some: { staffId } } } } }
      : {};
    const fnbFilter = normalizedRole === 'FNB_MANAGER'
      ? { toWarehouse: { posOutlet: { isNot: null } } }
      : {};

    const transfers = await prisma.stockTransfer.findMany({
      where: { propertyId: ctx.propertyIds[0], ...outletHeadFilter, ...fnbFilter },
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

    const { role, isSuperAdmin, id: userId, staffId } = session.user as any;
    const ctx = await requireInventoryAccess(session.user.id);
    const normalizedRole = String(role || '').toUpperCase();

    if (!hasInventoryPermission(role, 'inventory.transfer', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { fromWarehouseId, toWarehouseId, notes, items, selfIssue = false } = body;

    if (!fromWarehouseId || !toWarehouseId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ data: null, error: 'Source, destination, and at least one item are required' }, { status: 400 });
    }

    if (await isNightAuditTransactionLocked(ctx.propertyIds[0])) {
      return NextResponse.json({
        data: null,
        error: 'Stock transfers cannot be created while Night Audit is posting. Retry after the new business date is active.',
        code: 'NIGHT_AUDIT_IN_PROGRESS',
      }, { status: 409 });
    }

    // Validate both warehouses belong to property
    const warehouses = await prisma.warehouse.findMany({
      where: {
        id: { in: [fromWarehouseId, toWarehouseId] },
        propertyId: ctx.propertyIds[0],
        isActive: true,
      },
      include: { posOutlet: { select: { id: true, name: true } } },
    });

    const warehouseMap = new Map(warehouses.map(w => [w.id, w]));
    const sourceWarehouse      = warehouseMap.get(fromWarehouseId);
    const destinationWarehouse = warehouseMap.get(toWarehouseId);

    if (!sourceWarehouse || !destinationWarehouse) {
      return NextResponse.json({ data: null, error: 'Invalid warehouses' }, { status: 400 });
    }
    if (fromWarehouseId === toWarehouseId) {
      return NextResponse.json({ data: null, error: 'Source and destination must be different' }, { status: 400 });
    }

    // ── Access rule: STOCK_MANAGER, STOCK_KEEPER, FNB_MANAGER and OUTLET_HEAD
    //    may ONLY use a main (non-outlet) warehouse as the source. ───────────
    if (MAIN_WAREHOUSE_ROLES.has(normalizedRole) && sourceWarehouse.posOutlet) {
      return NextResponse.json({
        data: null,
        error: 'Stock can only be transferred FROM a main warehouse. Outlet warehouses cannot be used as a source.',
      }, { status: 403 });
    }

    // ── FNB_MANAGER can only transfer TO their own outlet ──────────────────
    if (normalizedRole === 'FNB_MANAGER') {
      if (!destinationWarehouse.posOutlet) {
        return NextResponse.json({
          data: null,
          error: 'F&B Manager can only request stock for an outlet warehouse.',
        }, { status: 403 });
      }
    }

    // ── OUTLET_HEAD can only transfer TO their assigned outlet ─────────────
    if (normalizedRole === 'OUTLET_HEAD') {
      if (!destinationWarehouse.posOutlet || !staffId) {
        return NextResponse.json({ data: null, error: 'Outlet heads can only request stock for their assigned outlet' }, { status: 403 });
      }
      const outletAccess = await prisma.staffPosOutletAccess.findUnique({
        where: { staffId_outletId: { staffId, outletId: destinationWarehouse.posOutlet.id } },
      });
      if (!outletAccess) {
        return NextResponse.json({ data: null, error: 'You are not assigned to this outlet' }, { status: 403 });
      }
    }

    // ── Determine initial status ───────────────────────────────────────────
    // Flow B: Stock Manager self-issues directly → ISSUED (top-management confirms later)
    const isStockStaff   = STOCK_STAFF_ROLES.has(normalizedRole);
    const isTopMgmt      = TOP_MANAGEMENT_ROLES.has(normalizedRole) || isSuperAdmin;
    const isSelfIssue    = selfIssue && (isStockStaff || isTopMgmt);
    // Flow A: FNB_MANAGER requests → PENDING_APPROVAL; Stock Manager will approve & issue
    // Draft/submit flow for all other users
    const initialStatus  = isSelfIssue ? 'ISSUED' : 'PENDING_APPROVAL';

    // ── Validate items ─────────────────────────────────────────────────────
    const stockItemIds = items.map((item: any) => item.stockItemId);
    const sourceItems  = await prisma.stockItem.findMany({
      where: { id: { in: stockItemIds }, propertyId: ctx.propertyIds[0], warehouseId: fromWarehouseId, isActive: true },
      select: { id: true, name: true, baseUnit: true, quantityOnHand: true, stockUnits: true },
    });
    const sourceById   = new Map(sourceItems.map(item => [item.id, item]));
    const seenItemIds  = new Set<string>();

    for (const item of items) {
      const quantity    = Number(item.quantity);
      const sourceItem  = sourceById.get(item.stockItemId);
      if (!sourceItem || seenItemIds.has(item.stockItemId)) {
        return NextResponse.json({ data: null, error: 'Each item must be an active item from the source warehouse, with no duplicates' }, { status: 400 });
      }
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > Number(sourceItem.quantityOnHand)) {
        return NextResponse.json({ data: null, error: `Invalid quantity for ${sourceItem.name}; available stock is ${sourceItem.quantityOnHand}` }, { status: 400 });
      }
      if (!Object.values(UnitOfMeasure).includes(item.unitOfMeasure)) {
        return NextResponse.json({ data: null, error: `Invalid unit for ${sourceItem.name}` }, { status: 400 });
      }
      const conversion = item.unitOfMeasure === sourceItem.baseUnit
        ? 1
        : Number(sourceItem.stockUnits.find((unit: any) => unit.unit === item.unitOfMeasure)?.unitsInBase || 0);
      if (conversion <= 0) {
        return NextResponse.json({ data: null, error: `No conversion configured from ${item.unitOfMeasure} to ${sourceItem.baseUnit} for ${sourceItem.name}` }, { status: 400 });
      }
      item.baseQuantity = quantity * conversion;
      if (item.baseQuantity > Number(sourceItem.quantityOnHand)) {
        return NextResponse.json({ data: null, error: `Invalid quantity for ${sourceItem.name}; available stock is ${sourceItem.quantityOnHand} ${sourceItem.baseUnit}` }, { status: 400 });
      }
      seenItemIds.add(item.stockItemId);
    }

    // ── Generate transfer ref ──────────────────────────────────────────────
    const count       = await prisma.stockTransfer.count({ where: { propertyId: { in: ctx.propertyIds as string[] } } });
    const transferRef = `TRF-${String(count + 1).padStart(5, '0')}`;

    const transfer = await prisma.stockTransfer.create({
      data: {
        propertyId: ctx.propertyIds[0],
        transferRef,
        fromWarehouseId,
        toWarehouseId,
        notes,
        status: initialStatus,
        requestedBy: userId,
        ...(isSelfIssue && { approvedBy: userId, approvedAt: new Date() }),
        items: {
          create: items.map((item: any) => ({
            stockItemId: item.stockItemId,
            quantity: item.quantity,
            unitOfMeasure: item.unitOfMeasure,
            baseQuantity: item.baseQuantity,
            notes: item.notes,
          })),
        },
      },
      include: { items: true },
    });

    // If self-issued, post the transfer immediately (stock deducted)
    if (isSelfIssue) {
      const result = await InventoryService.postTransfer(ctx, transfer.id, userId, crypto.randomUUID());
      return NextResponse.json({ data: (result as any).transfer || transfer, error: null });
    }

    return NextResponse.json({ data: transfer, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
