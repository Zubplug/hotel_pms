import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);
  const user = session.user as any;
  const body = await request.json();
        let reqPropertyId = body?.propertyId;
        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
        let reqOutletId = body?.outletId;
        if (reqOutletId && !ctx.outletIds.includes(reqOutletId)) return NextResponse.json({ error: 'Forbidden outlet' }, { status: 403 });
  const action = String(body.action || '').toLowerCase();
  const canApprove = hasInventoryPermission(user.role, 'inventory.adjust.approve', user.isSuperAdmin);
  if (!user.propertyId || !canApprove) return NextResponse.json({ error: 'Forbidden', data: null }, { status: 403 });
  const { id } = await params;
  const entry = await prisma.kitchenWasteEntry.findFirst({ where: { id, propertyId: user.propertyId } });
  if (!entry) return NextResponse.json({ error: 'Kitchen waste entry not found', data: null }, { status: 404 });
  const property = await prisma.property.findUnique({ where: { id: entry.propertyId }, select: { timezone: true, businessDate: true } });

  try {
    if (action === 'approve') {
      if (entry.status !== 'SUBMITTED') throw new Error('Only submitted waste can be approved');
      return NextResponse.json({ data: await prisma.kitchenWasteEntry.update({ where: { id }, data: { status: 'APPROVED', approvedBy: user.id, approvedAt: new Date() } }), error: null });
    }
    if (action === 'reject') {
      if (entry.status !== 'SUBMITTED') throw new Error('Only submitted waste can be rejected');
      return NextResponse.json({ data: await prisma.kitchenWasteEntry.update({ where: { id }, data: { status: 'REJECTED', rejectedBy: user.id, rejectedAt: new Date(), rejectionReason: String(body.reason || 'Rejected') } }), error: null });
    }
    if (action !== 'post') throw new Error('Action must be approve, reject, or post');
    if (entry.status !== 'APPROVED') throw new Error('Only approved waste can be posted');
    const posted = await prisma.$transaction(async (tx) => {
      const current = await tx.kitchenWasteEntry.findUnique({ where: { id } });
      if (!current || current.status !== 'APPROVED') throw new Error('Waste entry is no longer available for posting');
      const stock = await tx.stockItem.findUnique({ where: { id: current.stockItemId } });
      if (!stock) throw new Error('Stock item not found');
      const updated = await tx.stockItem.updateMany({ where: { id: stock.id, quantityOnHand: { gte: current.baseQuantity } }, data: { quantityOnHand: { decrement: current.baseQuantity } } });
      if (updated.count !== 1) throw new Error(`Insufficient stock to post waste for ${stock.name}`);
      const after = await tx.stockItem.findUnique({ where: { id: stock.id } });
      const transaction = await tx.stockTransaction.create({ data: {
        propertyId: current.propertyId, stockItemId: current.stockItemId, source: 'WASTE', quantity: -current.baseQuantity,
        unitCost: current.unitCost, totalValue: -current.totalValue, quantityBefore: stock.quantityOnHand,
        quantityAfter: after?.quantityOnHand || 0, warehouseId: stock.warehouseId, reference: current.id,
        notes: `Kitchen waste: ${current.reason}${current.notes ? ` — ${current.notes}` : ''}`, reason: 'WASTE',
        userId: user.id, businessDate: property?.businessDate || getPropertyBusinessDate(property?.timezone), operationId: `KITCHEN_WASTE_${current.id}`,
      } });
      return tx.kitchenWasteEntry.update({ where: { id }, data: { status: 'POSTED', postedBy: user.id, postedAt: new Date(), stockTransactionId: transaction.id } });
    });
    return NextResponse.json({ data: posted, error: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: null }, { status: 400 });
  }
}
