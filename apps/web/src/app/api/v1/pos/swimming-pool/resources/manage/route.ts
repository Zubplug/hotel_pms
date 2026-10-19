/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { requireOrganizationContext } from '@/lib/organization-access';

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

async function context() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHORIZED');
  const ctx = await requireOrganizationContext(session.user.id);
  return { session, ctx };
}

const MANAGER_ROLES = ['SUPER_ADMIN', 'ADMIN', 'OWNER', 'HOTEL_MANAGER', 'GENERAL_MANAGER', 'DIRECTOR'];
function isManager(session: any, ctx: any) {
  return MANAGER_ROLES.includes(String((session.user as any).role || ctx.role || '').toUpperCase());
}

const RESOURCE_TYPES = ['CABANA', 'LOUNGER', 'LOCKER', 'TOWEL'];

export async function GET(req: NextRequest) {
  try {
    const { session, ctx } = await context();
    const sp = req.nextUrl.searchParams;
    const propertyId = sp.get('propertyId') || (session.user as any).propertyId;
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return error('Forbidden', 403);

    const facilityId = sp.get('facilityId') || undefined;
    const includeInactive = sp.get('includeInactive') === 'true';

    const resources = await prisma.poolResource.findMany({
      where: {
        propertyId,
        ...(facilityId ? { facilityId } : {}),
        ...(includeInactive ? {} : { isActive: true }),
      },
      include: {
        facility: { select: { id: true, name: true } },
        bookings: {
          where: { status: { in: ['BOOKED', 'ACTIVE'] }, endAt: { gte: new Date() } },
          include: { entry: { include: { guest: { select: { firstName: true, lastName: true } } } } },
          orderBy: { startAt: 'asc' },
        },
      },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
    });

    return NextResponse.json({ data: resources });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return error('Unauthorized', 401);
    console.error('[POOL RESOURCES MANAGE GET]', err);
    return error('Internal Server Error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { session, ctx } = await context();
    if (!isManager(session, ctx)) return error('Only an authorized manager can create pool resources', 403);

    const body = await req.json();
    const propertyId = String(body.propertyId || (session.user as any).propertyId || '');
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return error('Forbidden', 403);

    if (!body.facilityId || !body.name || !body.code || !body.type) {
      return error('facilityId, name, code, and type are required');
    }

    const type = String(body.type).toUpperCase();
    if (!RESOURCE_TYPES.includes(type)) return error(`type must be one of: ${RESOURCE_TYPES.join(', ')}`);

    const facility = await prisma.poolFacility.findFirst({ where: { id: String(body.facilityId), propertyId, isActive: true } });
    if (!facility) return error('Facility not found', 404);

    const code = String(body.code).toUpperCase().trim();
    const existing = await prisma.poolResource.findFirst({ where: { propertyId, code } });
    if (existing) return error(`Resource code "${code}" already exists for this property`, 409);

    const status = String(body.status || 'AVAILABLE').toUpperCase();
    if (!['AVAILABLE', 'CLEANING', 'MAINTENANCE'].includes(status)) {
      return error('Initial status must be AVAILABLE, CLEANING, or MAINTENANCE');
    }

    const resource = await prisma.poolResource.create({
      data: {
        propertyId,
        facilityId: facility.id,
        name: String(body.name).trim(),
        code,
        type,
        status,
        isActive: true,
      },
    });

    return NextResponse.json({ data: resource }, { status: 201 });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return error('Unauthorized', 401);
    if (err?.code === 'P2002') return error('Resource code already exists for this property', 409);
    console.error('[POOL RESOURCES MANAGE POST]', err);
    return error('Internal Server Error', 500);
  }
}
