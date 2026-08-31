import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { InventoryAlertService } from '@/lib/inventory/InventoryAlertService';
import { requireOrganizationContext } from "@/lib/organization-access";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, isSuperAdmin } = session.user as any;
    const ctx = await requireOrganizationContext(session.user.id);

    if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    await InventoryAlertService.sync(ctx.propertyIds[0]);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'OPEN';
    const type = searchParams.get('type');

    const where: any = { propertyId: ctx.propertyIds[0], status };
    if (type) where.type = type;

    const alerts = await prisma.inventoryAlert.findMany({
      where,
      include: {
        stockItem: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: alerts, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
