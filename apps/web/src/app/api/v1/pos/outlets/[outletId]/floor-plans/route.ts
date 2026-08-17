import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { outletId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { outletId } = params;

    const floorPlans = await prisma.posFloorPlan.findMany({
      where: { outletId, isActive: true },
      include: {
        tables: {
          where: { isActive: true },
          orderBy: { name: 'asc' }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ data: floorPlans });
  } catch (error) {
    console.error('Fetch Floor Plans Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { outletId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { outletId } = params;
    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const floorPlan = await prisma.posFloorPlan.create({
      data: {
        outletId,
        name,
        isActive: true
      }
    });

    return NextResponse.json({ data: floorPlan }, { status: 201 });
  } catch (error) {
    console.error('Create Floor Plan Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
