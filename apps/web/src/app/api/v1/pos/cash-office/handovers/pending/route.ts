import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';

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
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
    }

    const allowed = (await requireOrganizationContext(session.user.id)).propertyIds;
    if (!allowed.includes(propertyId)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
            deviceId: true,
            outlet: { select: { id: true, name: true } },
            primaryOperator: { select: { id: true, firstName: true, lastName: true, position: true } },
            payments: { orderBy: { createdAt: 'desc' } },
            cashMovements: { orderBy: { createdAt: 'desc' } },
            orders: { select: { id: true, orderNumber: true, total: true, status: true, paymentStatus: true } }
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
