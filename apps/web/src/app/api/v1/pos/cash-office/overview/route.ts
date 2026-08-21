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

    // 1. Get SAFE balance
    const safeAccount = await prisma.cashAccount.findFirst({
      where: {
        propertyId,
        type: 'SAFE'
      }
    });

    // 2. Get Pending Handovers
    const pendingHandovers = await prisma.posSettlement.findMany({
      where: {
        propertyId,
        status: 'PENDING_HANDOVER'
      }
    });

    const pendingAmount = pendingHandovers.reduce((sum: number, h: any) => sum + Number(h.actualCash), 0);

    return NextResponse.json({
      data: {
        safeBalance: safeAccount ? Number(safeAccount.balance) : 0,
        pendingHandoversCount: pendingHandovers.length,
        pendingHandoversAmount: pendingAmount
      }
    });

  } catch (error: any) {
    console.error('Error fetching cash office overview:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
