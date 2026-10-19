/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ bookingId: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ctx = await requireOrganizationContext(session.user.id);
  const { bookingId } = await params;
  const body = await req.json();
  const booking = await prisma.poolResourceBooking.findFirst({ where: { id: bookingId, propertyId: { in: ctx.propertyIds as string[] } } });
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  const status = String(body.status || 'CANCELLED');
  if (!['BOOKED', 'ACTIVE', 'COMPLETED', 'CANCELLED'].includes(status)) return NextResponse.json({ error: 'Invalid booking status' }, { status: 400 });
  const updated = await prisma.$transaction(async (tx: any) => {
    if (['BOOKED', 'ACTIVE'].includes(status)) {
      const overlap = await tx.poolResourceBooking.findFirst({ where: { id: { not: booking.id }, resourceId: booking.resourceId, status: { in: ['BOOKED', 'ACTIVE'] }, startAt: { lt: booking.endAt }, endAt: { gt: booking.startAt } } });
      if (overlap) throw new Error('RESOURCE_BOOKED');
    }
    return tx.poolResourceBooking.update({ where: { id: booking.id }, data: { status } });
  });
  return NextResponse.json({ data: updated });
}
