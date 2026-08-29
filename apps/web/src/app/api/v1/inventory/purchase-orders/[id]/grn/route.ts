import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { hasInventoryPermission } from '@/lib/inventory/permissions';
import { ProcurementService } from '@/lib/inventory/ProcurementService';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { role, propertyId, isSuperAdmin, id: userId } = session.user as any;
    if (!hasInventoryPermission(role, 'inventory.receive', isSuperAdmin)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { items, deliveryNoteRef } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Items are required' }, { status: 400 });
    }

    const po = await prisma.purchaseOrder.findFirst({ where: { id: params.id, propertyId }, select: { id: true } });
    if (!po) return NextResponse.json({ error: 'Purchase Order not found' }, { status: 404 });

    const data = await ProcurementService.createGRN(params.id, userId, items, deliveryNoteRef);

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
