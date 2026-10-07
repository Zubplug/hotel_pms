import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

const KITCHEN_ROLES = ['KITCHEN_STAFF', 'CHEF', 'HEAD_CHEF', 'KITCHEN_MANAGER', 'CEO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'MANAGER', 'ADMIN', 'DIRECTOR'];

export async function GET(req: Request) {
  try {
    const session = await auth();
    const user = session?.user as any;
    if (!user || (!KITCHEN_ROLES.includes(String(user.role || '').toUpperCase()) && !(user.capabilities || []).some((value: string) => value === 'ACCESS_KITCHEN' || value.startsWith('kitchen.')))) {
      return NextResponse.json({ success: false, error: { message: 'Kitchen access required' } }, { status: 403 });
    }
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ success: false, error: { message: 'Missing propertyId' } }, { status: 400 });
    }

    const where: any = {
      order: { propertyId },
      status: { not: 'COMPLETED' }, // By default, fetch active batches only
    };

    // This endpoint belongs to the kitchen workspace and must never expose bar tickets.
    where.station = 'KITCHEN';

    const batches = await prisma.posProductionBatch.findMany({
      where,
      orderBy: [
        { firedAt: 'asc' }, // Oldest first
      ],
      include: {
        order: {
          select: {
            orderNumber: true,
            orderType: true,
            displayName: true,
            tableNumber: true,
            guestCount: true,
            serverStaff: { select: { firstName: true, lastName: true } },
            outlet: { select: { name: true } }
          }
        },
        items: true,
      }
    });

    return NextResponse.json({ success: true, data: batches });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: { message: error.message } }, { status: 500 });
  }
}
