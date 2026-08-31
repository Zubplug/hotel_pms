import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ outletId: string, floorPlanId: string, tableId: string }> }
) {
  try {
    const { tableId } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const body = await req.json();
        let reqPropertyId = body?.propertyId;
        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
        let reqOutletId = body?.outletId;
        if (reqOutletId && !ctx.outletIds.includes(reqOutletId)) return NextResponse.json({ error: 'Forbidden outlet' }, { status: 403 });
    const { name, capacity, positionX, positionY, isActive, currentOrderId } = body;

    const table = await prisma.posTable.update({
      where: { id: tableId },
      data: {
        ...(name && { name }),
        ...(capacity !== undefined && { capacity: Number(capacity) }),
        ...(positionX !== undefined && { positionX: Number(positionX) }),
        ...(positionY !== undefined && { positionY: Number(positionY) }),
        ...(isActive !== undefined && { isActive }),
        ...(currentOrderId !== undefined && { currentOrderId }),
      }
    });

    return NextResponse.json({ data: table });
  } catch (error) {
    console.error('Update Table Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ outletId: string, floorPlanId: string, tableId: string }> }
) {
  try {
    const { tableId } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    // Optional: check if there is an active order on this table before deleting
    const table = await prisma.posTable.findUnique({
      where: { id: tableId }
    });

    if (table?.currentOrderId) {
      return NextResponse.json({ error: 'Cannot delete table with an active order.' }, { status: 400 });
    }

    await prisma.posTable.delete({
      where: { id: tableId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Table Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
