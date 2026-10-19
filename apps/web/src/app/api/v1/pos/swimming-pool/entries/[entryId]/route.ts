/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ entryId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await requireOrganizationContext(session.user.id);
    const { entryId } = await params;
    const body = await req.json();
    const entry = await prisma.poolEntry.findFirst({ where: { id: entryId, propertyId: { in: ctx.propertyIds as string[] } }, include: { facility: true } });
    if (!entry) return NextResponse.json({ error: 'Pool entry not found' }, { status: 404 });
    const action = String(body.action || 'checkout');
    if (action === 'checkout') {
      if (entry.status !== 'ACTIVE') return NextResponse.json({ error: 'Only active entries can be checked out' }, { status: 409 });
      const updated = await prisma.poolEntry.update({ where: { id: entry.id }, data: { status: 'COMPLETED', exitedAt: new Date(), checkedOutBy: session.user.id } });
      return NextResponse.json({ data: updated });
    }
    if (action === 'checkin') {
      if (entry.status !== 'RESERVED') return NextResponse.json({ error: 'Only reserved entries can be checked in' }, { status: 409 });
      const updated = await prisma.$transaction(async (tx: any) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${entry.facilityId}:${entry.entryDate.toISOString().slice(0, 10)}`}, 0))`;
        const active = await tx.poolEntry.aggregate({ where: { propertyId: entry.propertyId, facilityId: entry.facilityId, status: 'ACTIVE' }, _sum: { guestCount: true } });
        if (Number(active._sum.guestCount || 0) + entry.guestCount > entry.facility.capacity) throw new Error('CAPACITY_EXCEEDED');
        return tx.poolEntry.update({ where: { id: entry.id }, data: { status: 'ACTIVE', admittedAt: new Date(), checkedInBy: session.user.id } });
      });
      return NextResponse.json({ data: updated });
    }
    return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
  } catch (err: any) {
    if (err?.message === 'CAPACITY_EXCEEDED') return NextResponse.json({ error: 'Pool capacity would be exceeded' }, { status: 409 });
    console.error('[POOL ENTRY PATCH]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
