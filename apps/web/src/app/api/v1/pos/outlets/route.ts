import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId') || (session.user as any).propertyId;

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    const outlets = await prisma.posOutlet.findMany({
      where: { propertyId },
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

    const data = await req.json();
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
