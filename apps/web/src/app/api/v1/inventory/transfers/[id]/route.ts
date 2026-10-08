import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from "@/lib/organization-access";

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, isSuperAdmin, staffId } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);

    if (!hasInventoryPermission(role, 'inventory.transfer', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const outletHeadFilter = String(role).toUpperCase() === 'OUTLET_HEAD' && staffId
      ? { toWarehouse: { posOutlet: { staffAccess: { some: { staffId } } } } }
      : {};
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: params.id, propertyId: ctx.propertyIds[0], ...outletHeadFilter },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: {
          include: {
            stockItem: true
          }
        }
      },
    });

    if (!transfer) {
      return NextResponse.json({ data: null, error: 'Not Found' }, { status: 404 });
    }

    const requesterRoles = transfer.requestedBy
      ? await prisma.userRole.findMany({ where: { userId: transfer.requestedBy }, select: { role: { select: { name: true } } } })
      : [];
    const requesterIsStockStaff = requesterRoles.some(({ role: requesterRole }) =>
      ['STOCK_MANAGER', 'STOCK_KEEPER'].includes(String(requesterRole.name || '').toUpperCase()),
    );

    return NextResponse.json({ data: { ...transfer, requesterIsStockStaff }, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    const normalizedRole = String(role || '').toUpperCase();
    const isStockStaff = ['STOCK_MANAGER', 'STOCK_KEEPER'].includes(normalizedRole);

    const body = await request.json();
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ data: null, error: 'At least one item quantity is required' }, { status: 400 });
    }

    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: params.id, propertyId: ctx.propertyIds[0] },
      include: { items: true, toWarehouse: { select: { posOutletId: true } } },
    });
    if (!transfer) return NextResponse.json({ data: null, error: 'Transfer not found' }, { status: 404 });
    if (!transfer.toWarehouse.posOutletId) return NextResponse.json({ data: null, error: 'Only outlet F&B requests can be reduced here' }, { status: 400 });
    if (!['PENDING_APPROVAL', 'APPROVED'].includes(transfer.status)) {
      return NextResponse.json({ data: null, error: 'Requests can only be reduced before stock is issued' }, { status: 400 });
    }

    const requesterRoles = transfer.requestedBy
      ? await prisma.userRole.findMany({ where: { userId: transfer.requestedBy }, select: { role: { select: { name: true } } } })
      : [];
    const requesterIsStockStaff = requesterRoles.some(({ role: requesterRole }) =>
      ['STOCK_MANAGER', 'STOCK_KEEPER'].includes(String(requesterRole.name || '').toUpperCase()),
    );
    if (requesterIsStockStaff && isStockStaff) {
      return NextResponse.json({ data: null, error: 'Management approval is required before adjusting a stock-control transfer' }, { status: 403 });
    }
    if (!hasInventoryPermission(role, 'inventory.transfer.approve', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Only authorized management or stock control can reduce a submitted request' }, { status: 403 });
    }

    const requestedById = new Map<string, number>();
    for (const item of body.items) {
      const itemId = String(item?.id || '');
      const quantity = Number(item?.quantity);
      if (!itemId || requestedById.has(itemId) || !Number.isFinite(quantity) || quantity <= 0) {
        return NextResponse.json({ data: null, error: 'Every revised quantity must be a positive number' }, { status: 400 });
      }
      requestedById.set(itemId, quantity);
    }

    const revisedItems = transfer.items.filter((item) => requestedById.has(item.id)).map((item) => {
      const quantity = requestedById.get(item.id)!;
      if (quantity > Number(item.quantity)) throw new Error('REQUEST_QUANTITY_INCREASE');
      if (quantity === Number(item.quantity)) throw new Error('REQUEST_NOT_REDUCED');
      const ratio = quantity / Number(item.quantity);
      return { id: item.id, quantity, baseQuantity: Number(item.baseQuantity || 0) * ratio };
    });
    if (!revisedItems.length) return NextResponse.json({ data: null, error: 'Reduce at least one requested quantity' }, { status: 400 });

    const updated = await prisma.$transaction(async (tx) => {
      for (const item of revisedItems) {
        await tx.stockTransferItem.update({ where: { id: item.id }, data: { quantity: item.quantity, baseQuantity: item.baseQuantity } });
      }
      return tx.stockTransfer.findUniqueOrThrow({ where: { id: transfer.id }, include: { items: true } });
    });

    return NextResponse.json({ data: updated, error: null });
  } catch (error: any) {
    if (error.message === 'REQUEST_QUANTITY_INCREASE') return NextResponse.json({ data: null, error: 'A request can only be reduced, not increased' }, { status: 400 });
    if (error.message === 'REQUEST_NOT_REDUCED') return NextResponse.json({ data: null, error: 'Enter a lower quantity for at least one item' }, { status: 400 });
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
