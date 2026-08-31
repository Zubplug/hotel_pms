import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { requireOrganizationContext } from "@/lib/organization-access";

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, isSuperAdmin, staffId } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);

    if (!hasInventoryPermission(role, 'inventory.transfer', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const outletHeadFilter = String(role).toUpperCase() === 'OUTLET_HEAD' && staffId
      ? { toWarehouse: { posOutlet: { staffAccess: { some: { staffId } } } } }
      : {};
    const transfer = await prisma.stockTransfer.findFirst({
      where: { id: params.id, propertyId: ctx.propertyIds[0], ...outletHeadFilter },
      include: {
        fromWarehouse: true,
        toWarehouse: true,
        items: {
          include: {
            stockItem: true
          }
        }
      },
    });

    if (!transfer) {
      return NextResponse.json({ data: null, error: 'Not Found' }, { status: 404 });
    }

    return NextResponse.json({ data: transfer, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
