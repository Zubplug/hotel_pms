import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from '@/lib/organization-access';

/**
 * POST /api/v1/inventory/transfers/[id]/receive
 *
 * Moves a transfer from ISSUED → COMPLETED (received/confirmed).
 *
 * Flow A — FNB_MANAGER receives stock they requested.
 * Flow B — Top management (ACCOUNTANT, GENERAL_MANAGER, GENERAL_CASHIER, etc.)
 *           confirms receipt of a Stock-Manager-initiated push.
 */
export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, isSuperAdmin, id: userId } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);

    // Permission gate
    if (!hasInventoryPermission(role, 'inventory.transfer.receive', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden — you do not have stock receiving rights' }, { status: 403 });
    }

    // Load transfer
    const transfer = await prisma.stockTransfer.findUnique({
      where: { id: params.id },
      select: {
        propertyId: true,
        status: true,
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
    if (transfer.status !== 'ISSUED') {
      return NextResponse.json({
        data: null,
        error: `Transfer cannot be received — current status is ${transfer.status}. Only ISSUED transfers can be received.`,
      }, { status: 400 });
    }

    const body           = await request.json().catch(() => ({}));
    const receiptNotes   = body?.notes || null;

    await prisma.stockTransfer.update({
      where: { id: params.id },
      data: {
        status: 'COMPLETED',
        ...(receiptNotes !== null && { notes: receiptNotes }),
        // Store who received and when in available audit fields
        approvedBy: transfer.requestedBy !== userId ? userId : undefined,
      },
    });

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
