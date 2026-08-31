import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { StocktakeService } from '@/lib/inventory/StocktakeService';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized', data: null }, { status: 401 });
    
    const { role, isSuperAdmin, id: userId } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    const body = await request.json();
    const { action } = body; // start, submit, reject, approve, post, cancel

    const stocktake = await prisma.stocktake.findUnique({
      where: { id: params.id, propertyId: ctx.propertyIds[0] },
      include: { items: true }
    });

    if (!stocktake) return NextResponse.json({ error: 'Not found', data: null }, { status: 404 });

    const hasManage = hasInventoryPermission(role, 'inventory.stocktake', isSuperAdmin);
    const hasApprove = hasInventoryPermission(role, 'inventory.stocktake.approve', isSuperAdmin);

    if (action === 'start') {
      if (!hasManage) {
        return NextResponse.json({ error: 'Cannot start', data: null }, { status: 400 });
      }
      await StocktakeService.startStocktake(stocktake.id, userId);
    } 
    else if (action === 'submit') {
      if (!hasManage) {
        return NextResponse.json({ error: 'Cannot submit', data: null }, { status: 400 });
      }
      await StocktakeService.submitStocktake(stocktake.id, userId);
    }
    else if (action === 'reject') {
      if (!hasApprove) {
        return NextResponse.json({ error: 'Cannot reject', data: null }, { status: 400 });
      }
      await StocktakeService.rejectStocktake(stocktake.id, userId, body.reason);
    }
    else if (action === 'approve') {
      if (!hasApprove) {
        return NextResponse.json({ error: 'Cannot approve', data: null }, { status: 400 });
      }
      await StocktakeService.approveStocktake(stocktake.id, userId);
    }
    else if (action === 'post') {
      if (!hasApprove) {
        return NextResponse.json({ error: 'Cannot post', data: null }, { status: 400 });
      }
      const operationId = crypto.randomUUID();
      await StocktakeService.postStocktake(stocktake.id, userId, operationId);
    }
    else if (action === 'cancel') {
      if (!hasManage) {
        return NextResponse.json({ error: 'Cannot cancel', data: null }, { status: 400 });
      }
      await StocktakeService.cancelStocktake(stocktake.id, userId);
    }
    else {
      return NextResponse.json({ error: 'Invalid action', data: null }, { status: 400 });
    }

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message, data: null }, { status: 500 });
  }
}
