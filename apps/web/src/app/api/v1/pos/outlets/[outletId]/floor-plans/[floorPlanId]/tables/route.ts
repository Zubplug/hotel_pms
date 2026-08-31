import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function POST(
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
    const { name, capacity, positionX, positionY } = body;

    if (!name || capacity === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const table = await prisma.posTable.create({
      data: {
        floorPlanId,
        name,
        capacity: Number(capacity),
        positionX: Number(positionX || 0),
        positionY: Number(positionY || 0),
        isActive: true
      }
    });

    return NextResponse.json({ data: table }, { status: 201 });
  } catch (error) {
    console.error('Create Table Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
