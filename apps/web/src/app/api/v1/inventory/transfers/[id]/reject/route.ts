import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, isSuperAdmin, id: userId } = session.user as any;
    const normalizedRole = String(role || '').toUpperCase();
    const isStockStaff = ['STOCK_MANAGER', 'STOCK_KEEPER'].includes(normalizedRole);
    const ctx = await requireOrganizationContext(session.user.id);

    // Permission gate: Anyone who can approve a transfer can reject it.
    // Also FNB managers can reject/cancel their own request? Actually, let's keep it strictly to approvers.
    if (!hasInventoryPermission(role, 'inventory.transfer.approve', isSuperAdmin) && !hasInventoryPermission(role, 'inventory.transfer', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const reason = body?.reason?.trim();
    
    if (!reason) {
      return NextResponse.json({ data: null, error: 'A reason must be provided to reject a transfer.' }, { status: 400 });
    }

    // Load transfer
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: params.id },
      select: {
        propertyId: true,
        status: true,
        notes: true,
        requestedBy: true,
        toWarehouse: { select: { posOutletId: true } },
      },
    });

    if (!transfer) {
      return NextResponse.json({ data: null, error: 'Transfer not found' }, { status: 404 });
    }
    if (transfer.propertyId !== ctx.propertyIds[0]) {
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }

    // Stock-control requests sent to an outlet require management to decide
    // both approval and rejection. Do not rely on the UI for this rule.
    const requesterRoles = transfer.requestedBy
      ? await prisma.userRole.findMany({ where: { userId: transfer.requestedBy }, select: { role: { select: { name: true } } } })
      : [];
    const requesterIsStockStaff = requesterRoles.some(({ role: requesterRole }) =>
      ['STOCK_MANAGER', 'STOCK_KEEPER'].includes(String(requesterRole.name || '').toUpperCase()),
    );
    if (transfer.toWarehouse.posOutletId && requesterIsStockStaff && isStockStaff) {
      return NextResponse.json({ data: null, error: 'A management staff member must approve or reject stock-control requests made for F&B' }, { status: 403 });
    }
    if (!['PENDING_APPROVAL', 'APPROVED'].includes(transfer.status)) {
      return NextResponse.json({
        data: null,
        error: `Transfer cannot be rejected — current status is ${transfer.status}.`,
      }, { status: 400 });
    }

    // If FNB manager is trying to reject, it must be their own request (cancelling).
    if (String(role).toUpperCase() === 'FNB_MANAGER' && transfer.requestedBy !== userId) {
      return NextResponse.json({ data: null, error: 'You can only cancel your own requests.' }, { status: 403 });
    }

    const appendNote = transfer.notes ? `${transfer.notes}\n\nREJECTED: ${reason}` : `REJECTED: ${reason}`;

    await prisma.stockTransfer.update({
      where: { id: params.id },
      data: {
        status: 'REJECTED',
        notes: appendNote,
        approvedBy: userId, // Using approvedBy to store who rejected it, as no rejectedBy field exists
      },
    });

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
