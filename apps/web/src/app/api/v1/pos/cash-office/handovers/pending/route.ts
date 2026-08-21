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
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
    }

    const pendingHandovers = await prisma.posSettlement.findMany({
      where: {
        propertyId,
        status: 'PENDING_HANDOVER'
      },
      include: {
        session: {
          select: {
            id: true,
            openedBy: true,
            status: true,
            bankType: true,
            deviceId: true
          }
        }
      },
      orderBy: {
        settledAt: 'desc'
      }
    });

    return NextResponse.json({ data: pendingHandovers });

  } catch (error: any) {
    console.error('Error fetching pending handovers:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
