import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function PUT(
  req: NextRequest,
  { params }: { params: { outletId: string, floorPlanId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { floorPlanId } = params;
    const body = await req.json();
    const { name, isActive } = body;

    const floorPlan = await prisma.posFloorPlan.update({
      where: { id: floorPlanId },
      data: {
        ...(name && { name }),
        ...(isActive !== undefined && { isActive })
      }
    });

    return NextResponse.json({ data: floorPlan });
  } catch (error) {
    console.error('Update Floor Plan Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { outletId: string, floorPlanId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { floorPlanId } = params;

    // Check if tables exist
    const tablesCount = await prisma.posTable.count({
      where: { floorPlanId }
    });

    if (tablesCount > 0) {
      return NextResponse.json({ error: 'Cannot delete floor plan with existing tables. Remove tables first.' }, { status: 400 });
    }

    await prisma.posFloorPlan.delete({
      where: { id: floorPlanId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete Floor Plan Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
