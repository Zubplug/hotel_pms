import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await verifyOperatorToken(token);
    if (!decoded) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const propertyId = req.nextUrl.searchParams.get('propertyId') || decoded.propertyId;
    const operatorId = decoded.staffId;

    const approvedShifts = await prisma.posSession.findMany({
      where: {
        propertyId,
        openedBy: operatorId,
        controlStatus: { in: ['APPROVED', 'APPROVED_WITH_VARIANCE'] }
      },
      orderBy: {
        openedAt: 'desc'
      },
      take: 10
    });

    return NextResponse.json({ data: approvedShifts });
  } catch (error: any) {
    console.error('[Approved Shifts]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
