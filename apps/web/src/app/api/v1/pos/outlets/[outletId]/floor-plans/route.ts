import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ outletId: string }> }
) {
  try {
    const { outletId } = await params;

    // Accept either admin session OR POS operator token
    const session = await auth();
    const authHeader = req.headers.get('Authorization');
    const operatorToken = authHeader?.replace('Bearer ', '');
    const operatorPayload = operatorToken ? await verifyOperatorToken(operatorToken) : null;

    if (!session?.user && !operatorPayload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
  { params }: { params: Promise<{ outletId: string }> }
) {
  try {
    const { outletId } = await params;
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { name } = body;

    if (!name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const floorPlan = await prisma.posFloorPlan.create({
      data: { outletId,
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
