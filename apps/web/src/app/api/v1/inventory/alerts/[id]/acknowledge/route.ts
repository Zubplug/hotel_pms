import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, propertyId, isSuperAdmin, id: userId } = session.user as any;

    if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const alert = await prisma.inventoryAlert.updateMany({
      where: { id: params.id, propertyId },
      data: {
        status: 'ACKNOWLEDGED' as any,
        acknowledgedBy: userId,
        acknowledgedAt: new Date()
      }
    });

    if (alert.count === 0) {
      return NextResponse.json({ data: null, error: 'Alert not found' }, { status: 404 });
    }

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
