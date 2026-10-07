import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from '@/lib/organization-access';

const STOCK_STAFF_ROLES = new Set(['STOCK_MANAGER', 'STOCK_KEEPER']);

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, isSuperAdmin, id: userId } = session.user as any;
    const ctx             = await requireOrganizationContext(session.user.id);
    const normalizedRole  = String(role || '').toUpperCase();

    // Load the transfer with destination context
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: params.id },
      select: {
        propertyId: true,
        requestedBy: true,
        status: true,
        toWarehouse: { select: { posOutletId: true } },
      },
    });

    if (!transfer) {
      return NextResponse.json({ data: null, error: 'Transfer not found' }, { status: 404 });
    }
    if (transfer.propertyId !== ctx.propertyIds[0]) {
      return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
    }
    if (transfer.status !== 'PENDING_APPROVAL') {
      return NextResponse.json({ data: null, error: 'Transfer is not pending approval' }, { status: 400 });
    }

    const requesterRoles = transfer.requestedBy
      ? await prisma.userRole.findMany({ where: { userId: transfer.requestedBy }, select: { role: { select: { name: true } } } })
      : [];
    const requesterIsStockStaff = requesterRoles.some(({ role: requesterRole }) =>
      STOCK_STAFF_ROLES.has(String(requesterRole.name || '').toUpperCase()),
    );

    const isOutletBound = Boolean(transfer.toWarehouse.posOutletId);

    // ── Flow A: Stock Manager/Keeper approves an FNB-requested outlet transfer ──
    // Stock staff can approve FNB requests, but cannot approve a request made
    // by stock staff on behalf of F&B. Those requests require management.
    if (isOutletBound && STOCK_STAFF_ROLES.has(normalizedRole) && !requesterIsStockStaff) {
      await prisma.stockTransfer.update({
        where: { id: params.id },
        data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
      });
      return NextResponse.json({ data: { success: true }, error: null });
    }

    if (requesterIsStockStaff && STOCK_STAFF_ROLES.has(normalizedRole)) {
      return NextResponse.json({ data: null, error: 'A management staff member must approve stock-control requests made for F&B' }, { status: 403 });
    }

    // ── All other transfers: standard management approval ──────────────────
    if (!hasInventoryPermission(role, 'inventory.transfer.approve', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden — you do not have transfer approval rights' }, { status: 403 });
    }

    // Prevent self-approval
    if (transfer.requestedBy === userId && !isSuperAdmin) {
      return NextResponse.json({ data: null, error: 'You cannot approve your own transfer request' }, { status: 403 });
    }

    await prisma.stockTransfer.update({
      where: { id: params.id },
      data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
    });

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
