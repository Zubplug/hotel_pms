import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ outletId: string, floorPlanId: string }> }
) {
  try {
    const { floorPlanId } = await params;
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
  { params }: { params: Promise<{ outletId: string, floorPlanId: string }> }
) {
  try {
    const { floorPlanId } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

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
