import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { canApprove } from '@/lib/approval-config';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, propertyId, isSuperAdmin, id: userId } = session.user as any;
    
    const transferCheck = await prisma.stockTransfer.findUnique({
      where: { id: params.id },
      select: { propertyId: true, requestedBy: true }
    });
    
    if (!transferCheck) {
      return NextResponse.json({ data: null, error: 'Transfer not found' }, { status: 404 });
    }

    const transferDetails = await prisma.stockTransfer.findUnique({
      where: { id: params.id },
      include: { toWarehouse: { select: { posOutletId: true } } },
    });
    const isOutletIssue = Boolean(transferDetails?.toWarehouse.posOutletId);
    const isStockIssuer = ['STOCK_KEEPER', 'STOCK_MANAGER'].includes(String(role).toUpperCase());
    if (isOutletIssue && isStockIssuer) {
      const updated = await prisma.stockTransfer.updateMany({
        where: { id: params.id, propertyId, status: 'PENDING_APPROVAL' },
        data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
      });
      if (!updated.count) return NextResponse.json({ data: null, error: 'Transfer is not pending approval' }, { status: 400 });
      return NextResponse.json({ data: { success: true }, error: null });
    }

    const guard = await canApprove({
      flowType: 'STOCK_TRANSFER',
      propertyId: transferCheck.propertyId,
      approverRole: role,
      approverIsSuperAdmin: isSuperAdmin,
      requesterId: transferCheck.requestedBy || undefined,
      approverId: userId,
    });

    if (!guard.allowed) {
      return NextResponse.json({ data: null, error: guard.reason || 'Forbidden' }, { status: 403 });
    }

    const transfer = await prisma.stockTransfer.updateMany({
      where: { 
        id: params.id, 
        propertyId,
        status: 'PENDING_APPROVAL'
      },
      data: {
        status: 'APPROVED',
        approvedBy: userId,
        approvedAt: new Date()
      }
    });

    if (transfer.count === 0) {
      return NextResponse.json({ data: null, error: 'Transfer not found or not in PENDING_APPROVAL status' }, { status: 400 });
    }

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
