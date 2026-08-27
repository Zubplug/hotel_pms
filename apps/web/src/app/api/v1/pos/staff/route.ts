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
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
    }

    // Get staff who have access to this property and are active
    const staff = await prisma.staff.findMany({
      where: {
        propertyAccess: { has: propertyId },
        isActive: true,
        position: { in: ['WAITER', 'WAITRESS', 'CASHIER'] },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: true,
        position: true,
        // Don't send posPinHash or other sensitive data
      },
      orderBy: { firstName: 'asc' }
    });

    return NextResponse.json({ data: staff });
  } catch (error) {
    console.error('Failed to fetch POS staff:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
