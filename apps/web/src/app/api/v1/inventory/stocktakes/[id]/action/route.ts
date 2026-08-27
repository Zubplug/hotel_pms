import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { StocktakeService } from '@/lib/inventory/StocktakeService';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
    
    const { role, propertyId, isSuperAdmin, id: userId } = session.user as any;
    const body = await request.json();
    const { action } = body; // start, submit, reject, approve, post, cancel

    const stocktake = await prisma.stocktake.findUnique({
      where: { id: params.id, propertyId },
      include: { items: true }
    });

    if (!stocktake) return NextResponse.json({ error: 'Not found', data: null }, { status: 404 });

    const hasManage = hasInventoryPermission(role, 'inventory.stocktake', isSuperAdmin);
    const hasApprove = hasInventoryPermission(role, 'inventory.stocktake.approve', isSuperAdmin);

    if (action === 'start') {
      if (!hasManage || stocktake.status !== 'DRAFT' && stocktake.status !== 'REJECTED') {
        return NextResponse.json({ error: 'Cannot start', data: null }, { status: 400 });
      }
      await prisma.stocktake.update({
        where: { id: stocktake.id },
        data: { status: 'COUNTING', startedBy: userId, startedAt: new Date() }
      });
    } 
    else if (action === 'submit') {
      if (!hasManage || stocktake.status !== 'COUNTING') {
        return NextResponse.json({ error: 'Cannot submit', data: null }, { status: 400 });
      }
      
      // Calculate variances
      const updates = stocktake.items.map(item => {
        const expectedQty = item.expectedQty.toNumber();
        const countedQty = item.countedQty ? item.countedQty.toNumber() : expectedQty; // Default to expected if left blank? Or error? Let's assume blank means 0. Wait, strict inventory control requires entering 0. 
        const actualCounted = item.countedQty ? item.countedQty.toNumber() : 0;
        const variance = actualCounted - expectedQty;
        const costAtCount = item.costAtCount.toNumber();
        const varianceValue = variance * costAtCount;

        return prisma.stocktakeItem.update({
          where: { id: item.id },
          data: { variance, varianceValue }
        });
      });

      updates.push(prisma.stocktake.update({
        where: { id: stocktake.id },
        data: { status: 'SUBMITTED', submittedBy: userId, submittedAt: new Date() }
      }) as any);

      await prisma.$transaction(updates);
    }
    else if (action === 'reject') {
      if (!hasApprove || stocktake.status !== 'SUBMITTED') {
        return NextResponse.json({ error: 'Cannot reject', data: null }, { status: 400 });
      }
      await prisma.stocktake.update({
        where: { id: stocktake.id },
        data: { status: 'REJECTED', rejectedBy: userId, rejectedAt: new Date() }
      });
    }
    else if (action === 'approve') {
      if (!hasApprove || stocktake.status !== 'SUBMITTED') {
        return NextResponse.json({ error: 'Cannot approve', data: null }, { status: 400 });
      }
      // Note: Threshold checking (e.g. Variance Value <= 50,000) could be implemented here via ApprovalConfig
      await prisma.stocktake.update({
        where: { id: stocktake.id },
        data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() }
      });
    }
    else if (action === 'post') {
      if (!hasApprove || stocktake.status !== 'APPROVED') {
        return NextResponse.json({ error: 'Cannot post', data: null }, { status: 400 });
      }
      const operationId = crypto.randomUUID();
      await StocktakeService.postStocktake(stocktake.id, userId, operationId);
    }
    else if (action === 'cancel') {
      if (!hasManage || ['POSTED', 'COMPLETED', 'CANCELLED'].includes(stocktake.status)) {
        return NextResponse.json({ error: 'Cannot cancel', data: null }, { status: 400 });
      }
      await prisma.stocktake.update({
        where: { id: stocktake.id },
        data: { status: 'CANCELLED' }
      });
    }
    else {
      return NextResponse.json({ error: 'Invalid action', data: null }, { status: 400 });
    }

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: null }, { status: 500 });
  }
}
