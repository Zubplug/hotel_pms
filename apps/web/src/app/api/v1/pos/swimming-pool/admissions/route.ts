/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';
import { getPropertyBusinessDate } from '@/lib/date-utils';

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function context() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHORIZED');
  const ctx = await requireOrganizationContext(session.user.id);
  return { session, ctx };
}

export async function GET(req: NextRequest) {
  try {
    const { session, ctx } = await context();
    const sp = req.nextUrl.searchParams;
    const propertyId = sp.get('propertyId') || (session.user as any).propertyId;
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return error('Forbidden', 403);

    const facilityId = sp.get('facilityId') || undefined;
    const statusFilter = sp.get('status')?.split(',').filter(Boolean);
    const search = sp.get('search')?.trim();
    const page = Math.max(1, Number(sp.get('page') || 1));
    const limit = Math.min(200, Math.max(1, Number(sp.get('limit') || 50)));
    const skip = (page - 1) * limit;

    // Date range — default to today (property business date)
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { businessDate: true, timezone: true },
    });
    if (!property) return error('Property not found', 404);
    const businessDate = property.businessDate || getPropertyBusinessDate(property.timezone);

    const fromRaw = sp.get('from');
    const toRaw = sp.get('to');
    const from = fromRaw ? new Date(`${fromRaw}T00:00:00.000Z`) : businessDate;
    const to = toRaw ? new Date(`${toRaw}T00:00:00.000Z`) : (() => {
      const d = new Date(from);
      d.setUTCDate(d.getUTCDate() + 1);
      return d;
    })();

    const where: any = {
      propertyId,
      ...(facilityId ? { facilityId } : {}),
      entryDate: { gte: from, lt: to },
      ...(statusFilter?.length ? { status: { in: statusFilter } } : {}),
    };

    // Search: entry number, identifier, or guest name
    if (search && search.length >= 2) {
      where.OR = [
        { entryNumber: { contains: search, mode: 'insensitive' } },
        { identifier: { contains: search, mode: 'insensitive' } },
        { guest: { OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ]}},
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, entries] = await Promise.all([
      prisma.poolEntry.count({ where }),
      prisma.poolEntry.findMany({
        where,
        include: {
          guest: { select: { id: true, firstName: true, lastName: true, phone: true } },
          passType: { select: { id: true, name: true, code: true, guestClass: true, price: true, currency: true } },
          facility: { select: { id: true, name: true, capacity: true } },
          posOrder: { select: { id: true, orderNumber: true, total: true, paymentStatus: true } },
          resourceBookings: {
            where: { status: { in: ['BOOKED', 'ACTIVE'] } },
            include: { resource: { select: { id: true, name: true, type: true } } },
          },
        },
        orderBy: [{ entryDate: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({ data: { entries, total, page, limit } });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return error('Unauthorized', 401);
    console.error('[POOL ADMISSIONS GET]', err);
    return error('Internal Server Error', 500);
  }
}
