import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { canApprove } from '@/lib/approval-config';
import { ProcurementService } from '@/lib/inventory/ProcurementService';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, isSuperAdmin, id: userId } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);
    
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: params.id },
      select: { propertyId: true, totalAmount: true, createdBy: true }
    });
    
    if (!po) return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });

    const guard = await canApprove({
      flowType: 'PURCHASE_ORDER',
      propertyId: po.propertyId,
      approverRole: role,
      approverIsSuperAdmin: isSuperAdmin,
      requesterId: po.createdBy || undefined,
      approverId: userId,
      amount: Number(po.totalAmount || 0)
    });

    if (!guard.allowed) {
      return NextResponse.json({ error: guard.reason || 'Forbidden' }, { status: 403 });
    }

    const data = await ProcurementService.approvePO(params.id, userId);

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
