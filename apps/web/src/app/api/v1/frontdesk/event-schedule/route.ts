import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const session = await auth();
  const propertyId = req.nextUrl.searchParams.get('propertyId') || session?.user?.propertyId;
  if (!propertyId) return NextResponse.json({ error: 'Property is required.' }, { status: 400 });

  const today = new Date();
  const horizon = new Date(today);
  horizon.setDate(horizon.getDate() + 90);
  const bookings = await prisma.eventBooking.findMany({
    where: {
      hall: { propertyId },
      status: { not: 'CANCELLED' },
      endTime: { gte: new Date(today.getTime() - 24 * 60 * 60 * 1000) },
      startTime: { lte: horizon },
      event: { status: { not: 'CANCELLED' } },
    },
    select: {
      id: true, eventId: true, hallId: true, startTime: true, endTime: true,
      setupBufferMinutes: true, teardownBufferMinutes: true, status: true,
      hall: { select: { name: true, code: true, capacity: true } },
      event: { select: { name: true, status: true, contactName: true, expectedGuests: true } },
    },
    orderBy: { startTime: 'asc' },
  });
  return NextResponse.json({ success: true, data: bookings });
}
