/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const ctx = await requireOrganizationContext(session.user.id);
  const propertyId = req.nextUrl.searchParams.get('propertyId') || (session.user as any).propertyId;
  if (!propertyId || !ctx.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
  const resources = await prisma.poolResource.findMany({ where: { propertyId, isActive: true }, include: { facility: true, bookings: { where: { status: { in: ['BOOKED', 'ACTIVE'] }, endAt: { gte: new Date() } }, orderBy: { startAt: 'asc' }, take: 20 } }, orderBy: [{ facilityId: 'asc' }, { type: 'asc' }, { name: 'asc' }] });
  return NextResponse.json({ data: resources });
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const ctx = await requireOrganizationContext(session.user.id);
    const body = await req.json();
    const propertyId = String(body.propertyId || (session.user as any).propertyId || '');
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden property' }, { status: 403 });
    const { resourceId, entryId, startAt, endAt } = body;
    if (!resourceId || !startAt || !endAt || new Date(endAt) <= new Date(startAt)) return NextResponse.json({ error: 'Resource, start and end times are required' }, { status: 400 });
    const booking = await prisma.$transaction(async (tx: any) => {
      const resource = await tx.poolResource.findFirst({ where: { id: String(resourceId), propertyId, isActive: true } });
      if (!resource) throw new Error('RESOURCE_NOT_FOUND');
      if (resource.status === 'MAINTENANCE') throw new Error('RESOURCE_UNAVAILABLE');
      const overlap = await tx.poolResourceBooking.findFirst({ where: { resourceId: resource.id, status: { in: ['BOOKED', 'ACTIVE'] }, startAt: { lt: new Date(endAt) }, endAt: { gt: new Date(startAt) } } });
      if (overlap) throw new Error('RESOURCE_BOOKED');
      if (entryId) {
        const entry = await tx.poolEntry.findFirst({ where: { id: String(entryId), propertyId }, select: { id: true } });
        if (!entry) throw new Error('ENTRY_NOT_FOUND');
      }
      return tx.poolResourceBooking.create({ data: { propertyId, resourceId: resource.id, entryId: entryId || undefined, startAt: new Date(startAt), endAt: new Date(endAt), status: 'BOOKED', notes: body.notes ? String(body.notes) : undefined, createdBy: session.user.id }, include: { resource: true, entry: true } });
    });
    return NextResponse.json({ data: booking }, { status: 201 });
  } catch (err: any) {
    const messages: Record<string, string> = { RESOURCE_NOT_FOUND: 'Resource not found', RESOURCE_UNAVAILABLE: 'Resource is under maintenance', RESOURCE_BOOKED: 'Resource is already booked for that time', ENTRY_NOT_FOUND: 'Pool entry not found' };
    if (messages[err?.message]) return NextResponse.json({ error: messages[err.message] }, { status: 409 });
    console.error('[POOL RESOURCE POST]', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
