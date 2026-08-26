import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, propertyId, isSuperAdmin } = session.user as any;
    if (!hasInventoryPermission(role, 'inventory.read', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const purchaseOrder = await prisma.purchaseOrder.findUnique({
      where: { id: params.id, propertyId },
      include: {
        supplier: true,
        items: true,
        grns: true,
      },
    });

    if (!purchaseOrder) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    return NextResponse.json({ data: purchaseOrder });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, propertyId, isSuperAdmin } = session.user as any;
    if (!hasInventoryPermission(role, 'procurement.po.create', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { notes, expectedDate } = body;

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: params.id, propertyId },
    });

    if (!po) {
      return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });
    }

    if (po.status !== 'DRAFT') {
      return NextResponse.json({ error: 'Only DRAFT purchase orders can be updated' }, { status: 400 });
    }

    const updatedPo = await prisma.purchaseOrder.update({
      where: { id: params.id, propertyId },
      data: {
        ...(notes !== undefined && { notes }),
        ...(expectedDate !== undefined && { expectedDate: expectedDate ? new Date(expectedDate) : null }),
      },
    });

    return NextResponse.json({ data: updatedPo });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
