import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');
    const station = searchParams.get('station');

    if (!propertyId) {
      return NextResponse.json({ success: false, error: { message: 'Missing propertyId' } }, { status: 400 });
    }

    const where: any = {
      order: { propertyId },
      status: { not: 'COMPLETED' }, // By default, fetch active batches only
    };

    if (station && station !== 'ALL') {
      where.station = station.toUpperCase();
    }

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
