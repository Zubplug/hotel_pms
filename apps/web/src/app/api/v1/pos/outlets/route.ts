import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId') || (session.user as any).propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    const outlets = await prisma.posOutlet.findMany({
      where: { propertyId: { in: ctx.propertyIds as string[] } },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ data: outlets });
  } catch (error: any) {
    console.error('Error fetching POS outlets:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || (session.user.role !== 'SUPER_ADMIN' && session.user.role !== 'HOTEL_MANAGER')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const data = await req.json();
        let reqPropertyId = data?.propertyId;
        if (reqPropertyId && !ctx.propertyIds.includes(reqPropertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
        let reqOutletId = data?.outletId;
        if (reqOutletId && !ctx.outletIds.includes(reqOutletId)) return NextResponse.json({ error: 'Forbidden outlet' }, { status: 403 });
    const propertyId = data.propertyId || (session.user as any).propertyId;
    const { name, isActive } = data;

    if (!propertyId || !name) {
      return NextResponse.json({ error: 'propertyId and name are required' }, { status: 400 });
    }

    const outlet = await prisma.posOutlet.create({
      data: {
        propertyId: String(propertyId),
        name: String(name),
        type: data.type ? String(data.type) : 'RESTAURANT',
        isActive: isActive !== undefined ? Boolean(isActive) : true
      }
    });

    return NextResponse.json({ data: outlet });
  } catch (error: any) {
    console.error('Error creating POS outlet:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
