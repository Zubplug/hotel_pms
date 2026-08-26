import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { role, propertyId, isSuperAdmin } = session.user as any;

    if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const grn = await prisma.goodsReceivedNote.findFirst({
      where: { id: params.id, propertyId },
      include: {
        purchaseOrder: true,
        items: true
      },
    });

    if (!grn) {
      return NextResponse.json({ data: null, error: 'Not Found' }, { status: 404 });
    }

    return NextResponse.json({ data: grn, error: null });
  } catch (error: any) {
    return NextResponse.json({ data: null, error: error.message || 'Internal Error' }, { status: 500 });
  }
}
