import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { requireEntitlement } from '@/lib/auth/entitlement';

export const dynamic = 'force-dynamic';

const MANAGER_ROLES = new Set(['HOUSEKEEPING_MAINTENANCE_MANAGER', 'HOUSEKEEPING_MANAGER', 'MAINTENANCE_MANAGER']);

function isDepartmentWarehouse(name: string) {
  return /housekeeping|laundry|linen|uniform|\bhk\b/i.test(name);
}

function isHousekeepingCategory(name?: string | null) {
  return /housekeeping|laundry|linen/i.test(name || '');
}

async function context() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHORIZED');
  const role = String((session.user as any).role || '').toUpperCase();
  const capabilities = ((session.user as any).capabilities || []) as string[];
  if (!MANAGER_ROLES.has(role) && !(capabilities.includes('ACCESS_HOUSEKEEPING') && capabilities.includes('ACCESS_MAINTENANCE'))) throw new Error('FORBIDDEN');
  const ctx = await requireOrganizationContext(session.user.id);
  const propertyId = (session.user as any).propertyId || ctx.propertyIds[0];
  if (!propertyId || !ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');
  await requireEntitlement(ctx.organizationId, 'MODULE_OPERATIONS', propertyId);
  return { session, propertyId };
}

function responseError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unexpected inventory error';
  const status = message === 'UNAUTHORIZED' ? 401 : message === 'FORBIDDEN' ? 403 : 500;
  return NextResponse.json({ data: null, error: message }, { status });
}

export async function GET() {
  try {
    const { propertyId } = await context();
    const warehouses = await prisma.warehouse.findMany({
      where: { propertyId, isActive: true },
      include: { posOutlet: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    const departmentWarehouses = warehouses.filter((warehouse) => isDepartmentWarehouse(warehouse.name));
    const mainWarehouses = warehouses.filter((warehouse) => !warehouse.posOutletId && !isDepartmentWarehouse(warehouse.name));
    const departmentIds = departmentWarehouses.map((warehouse) => warehouse.id);
    const mainIds = mainWarehouses.map((warehouse) => warehouse.id);

    const [stock, requests, issues] = await Promise.all([
      prisma.stockItem.findMany({
        where: { propertyId, warehouseId: { in: [...departmentIds, ...mainIds] }, isActive: true },
        include: { warehouse: { select: { id: true, name: true } }, inventoryCategory: { select: { name: true } } },
        orderBy: [{ warehouse: { name: 'asc' } }, { name: 'asc' }],
      }),
      prisma.stockTransfer.findMany({
        where: { propertyId, notes: { startsWith: 'HOUSEKEEPING_REQUISITION' } },
        include: { fromWarehouse: { select: { name: true } }, toWarehouse: { select: { name: true } }, items: { include: { stockItem: { select: { name: true, baseUnit: true } } } } },
        orderBy: { createdAt: 'desc' }, take: 30,
      }),
      prisma.stockTransaction.findMany({
        where: { propertyId, reference: { startsWith: 'HOUSEKEEPING_ISSUE_' }, warehouseId: { in: departmentIds } },
        include: { stockItem: { select: { name: true, baseUnit: true } }, warehouse: { select: { name: true } } },
        orderBy: { timestamp: 'desc' }, take: 40,
      }),
    ]);
    const mainStock = stock.filter((item) => mainIds.includes(item.warehouse.id));
    return NextResponse.json({ data: { warehouses: departmentWarehouses, mainWarehouses, mainStock, stock, requests, issues } });
  } catch (error) {
    return responseError(error);
  }
}

export async function POST(request: Request) {
  try {
    const { session, propertyId } = await context();
    const body = await request.json();
    const action = String(body.action || '').toUpperCase();

    if (action === 'REQUEST') {
      const { fromWarehouseId, toWarehouseId, items, notes } = body;
      if (!fromWarehouseId || !toWarehouseId || !Array.isArray(items) || items.length === 0) return NextResponse.json({ data: null, error: 'Source, destination, and at least one stock item are required' }, { status: 400 });
      const [source, destination] = await Promise.all([
        prisma.warehouse.findFirst({ where: { id: fromWarehouseId, propertyId, isActive: true } }),
        prisma.warehouse.findFirst({ where: { id: toWarehouseId, propertyId, isActive: true } }),
      ]);
      if (!source || source.posOutletId || isDepartmentWarehouse(source.name)) return NextResponse.json({ data: null, error: 'Requests must be supplied by a main warehouse' }, { status: 400 });
      if (!destination || !isDepartmentWarehouse(destination.name)) return NextResponse.json({ data: null, error: 'Choose a housekeeping or laundry outlet warehouse' }, { status: 400 });
      const sourceItems = await prisma.stockItem.findMany({ where: { id: { in: items.map((item: { stockItemId: string }) => item.stockItemId) }, propertyId, warehouseId: source.id, isActive: true }, include: { stockUnits: true } });
      const sourceById = new Map(sourceItems.map((item) => [item.id, item]));
      const transferItems = [];
      for (const item of items) {
        const sourceItem = sourceById.get(item.stockItemId);
        const quantity = Number(item.quantity);
        if (!sourceItem || !Number.isFinite(quantity) || quantity <= 0) return NextResponse.json({ data: null, error: 'Every request line must contain a valid main-warehouse item and quantity' }, { status: 400 });
        if (quantity > Number(sourceItem.quantityOnHand)) return NextResponse.json({ data: null, error: `Insufficient stock for ${sourceItem.name}` }, { status: 400 });
        transferItems.push({ stockItemId: sourceItem.id, quantity, unitOfMeasure: sourceItem.baseUnit, baseQuantity: quantity });
      }
      const transfer = await prisma.stockTransfer.create({
        data: { propertyId, fromWarehouseId: source.id, toWarehouseId: destination.id, transferRef: `HK-${randomUUID().slice(0, 8).toUpperCase()}`, status: 'PENDING_APPROVAL', requestedBy: session.user.id, notes: `HOUSEKEEPING_REQUISITION${notes ? ` · ${String(notes).trim()}` : ''}`, items: { create: transferItems } },
        include: { items: { include: { stockItem: { select: { name: true, baseUnit: true } } } }, fromWarehouse: { select: { name: true } }, toWarehouse: { select: { name: true } } },
      });
      return NextResponse.json({ data: transfer }, { status: 201 });
    }

    if (action === 'ISSUE') {
      const { warehouseId, stockItemId, quantity, notes } = body;
      const amount = Number(quantity);
      const warehouse = await prisma.warehouse.findFirst({ where: { id: warehouseId, propertyId, isActive: true } });
      if (!warehouse || !isDepartmentWarehouse(warehouse.name)) return NextResponse.json({ data: null, error: 'Choose a housekeeping or laundry outlet warehouse' }, { status: 400 });
      if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ data: null, error: 'A positive issue quantity is required' }, { status: 400 });
      const issue = await prisma.$transaction(async (tx) => {
        const item = await tx.stockItem.findFirst({ where: { id: stockItemId, propertyId, warehouseId, isActive: true } });
        if (!item) throw new Error('Stock item not found in the selected outlet warehouse');
        if (Number(item.quantityOnHand) < amount) throw new Error(`Insufficient ${item.name}; only ${item.quantityOnHand} ${item.baseUnit} available`);
        const updated = await tx.stockItem.update({ where: { id: item.id }, data: { quantityOnHand: { decrement: amount } } });
        return tx.stockTransaction.create({ data: { propertyId, stockItemId: item.id, warehouseId, source: 'ADJUSTMENT', reason: 'OTHER', quantity: -amount, unitCost: item.costPrice, quantityBefore: item.quantityOnHand, quantityAfter: updated.quantityOnHand, totalValue: -amount * Number(item.costPrice), reference: `HOUSEKEEPING_ISSUE_${randomUUID()}`, notes: `Issued for housekeeping/laundry operational use${notes ? ` · ${String(notes).trim()}` : ''}`, operationId: randomUUID(), userId: session.user.id, businessDate: new Date() } });
      });
      return NextResponse.json({ data: issue }, { status: 201 });
    }
    return NextResponse.json({ data: null, error: 'Unsupported inventory action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected inventory error';
    const status = ['UNAUTHORIZED', 'FORBIDDEN'].includes(message) ? (message === 'UNAUTHORIZED' ? 401 : 403) : 400;
    return NextResponse.json({ data: null, error: message }, { status });
  }
}
