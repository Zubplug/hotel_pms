import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

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

    const body = await req.json();
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
