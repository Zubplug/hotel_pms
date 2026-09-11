import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';

/**
 * GET /api/v1/pos/sessions/[sessionId]/open-orders
 *
 * Returns all open (UNPAID, not VOIDED) PosOrders linked to the session.
 * Used by the Night Audit wizard to block shift-close when orders are pending.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { sessionId } = await params;

    const session = await prisma.posSession.findUnique({
      where: { id: sessionId },
      select: { id: true, propertyId: true },
    });
    if (!session?.propertyId) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    const allowed = (await requireOrganizationContext(actor.user.id)).propertyIds;
    if (!allowed.includes(session.propertyId))
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const openOrders = await prisma.posOrder.findMany({
      where: {
        sessionId,
        paymentStatus: { not: 'PAID' },
        status: { notIn: ['VOIDED', 'CLOSED'] },
      },
      select: {
        id: true,
        orderNumber: true,
        tableNumber: true,
        total: true,
        status: true,
        paymentStatus: true,
        outlet: { select: { name: true } },
        serverStaff: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      data: openOrders.map(o => ({
        id: o.id,
        orderNumber: o.orderNumber,
        tableNumber: o.tableNumber,
        total: Number(o.total),
        status: o.status,
        paymentStatus: o.paymentStatus,
        outletName: o.outlet?.name ?? null,
        waiterName: o.serverStaff
          ? `${o.serverStaff.firstName} ${o.serverStaff.lastName}`.trim()
          : null,
      })),
    });
  } catch (error) {
    console.error('[open-orders]', error);
    return NextResponse.json({ error: 'Failed to fetch open orders' }, { status: 500 });
  }
}
