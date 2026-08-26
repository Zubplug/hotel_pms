import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, propertyId, isSuperAdmin, id: userId } = session.user as any;

    if (!hasInventoryPermission(role, 'inventory.adjust', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { stockItemId, warehouseId, currentQty, actualQty, reason, notes } = body;
    
    // Read the approval configuration for stock adjustments to save the required roles
    const { getFlowConfig } = await import('@/lib/approval-config');
    const adjustConfig = await getFlowConfig(propertyId, 'INVENTORY_ADJUSTMENT');

    const approvalRequest = await prisma.approvalRequest.create({
      data: {
        propertyId,
        type: 'INVENTORY_ADJUSTMENT',
        status: 'PENDING',
        requestedBy: userId,
        reason: reason || 'Stock count adjustment',
        details: {
          stockItemId,
          warehouseId,
          currentQty,
          actualQty,
          reason,
          notes,
          requiredApproverRoles: adjustConfig.approverRoles
        },
      }
    });

    return NextResponse.json({ data: approvalRequest, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
