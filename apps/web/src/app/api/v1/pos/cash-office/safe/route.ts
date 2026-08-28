import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { getUserPropertyIds } from '@/lib/property-access';

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

    const allowed = await getUserPropertyIds(session.user.id);
    if (!allowed.includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const safeAccount = await prisma.cashAccount.findFirst({
      where: {
        propertyId,
        type: 'SAFE'
      }
    });

    if (!safeAccount) {
      return NextResponse.json({
        data: {
          balance: 0,
          movements: []
        }
      });
    }

    // Fetch recent movements for the SAFE account
    const movements = await prisma.posCashMovement.findMany({
      where: {
        OR: [
          { sourceAccountId: safeAccount.id },
          { destinationAccountId: safeAccount.id }
        ]
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return NextResponse.json({
      data: {
        balance: Number(safeAccount.balance),
        movements
      }
    });

  } catch (error: any) {
    console.error('Error fetching safe ledger:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
