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

export async function GET(req: NextRequest, { params }: { params: Promise<{ resourceId: string }> }) {
  try {
    const { session, ctx } = await context();
    const { resourceId } = await params;
    const propertyId = req.nextUrl.searchParams.get('propertyId') || (session.user as any).propertyId;
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return error('Forbidden', 403);

    const resource = await prisma.poolResource.findFirst({
      where: { id: resourceId, propertyId },
      include: {
        facility: { select: { id: true, name: true } },
        bookings: {
          orderBy: { startAt: 'desc' },
          take: 20,
          include: { entry: { include: { guest: { select: { firstName: true, lastName: true } } } } },
        },
      },
    });
    if (!resource) return error('Resource not found', 404);
    return NextResponse.json({ data: resource });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return error('Unauthorized', 401);
    console.error('[POOL RESOURCE MANAGE GET]', err);
    return error('Internal Server Error', 500);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ resourceId: string }> }) {
  try {
    const { session, ctx } = await context();
    if (!isManager(session, ctx)) return error('Only an authorized manager can modify pool resources', 403);

    const { resourceId } = await params;
    const body = await req.json();
    const propertyId = String(body.propertyId || (session.user as any).propertyId || '');
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) return error('Forbidden', 403);

    const resource = await prisma.poolResource.findFirst({ where: { id: resourceId, propertyId } });
    if (!resource) return error('Resource not found', 404);

    // Code uniqueness check
    if (body.code && String(body.code).toUpperCase() !== resource.code) {
      const newCode = String(body.code).toUpperCase().trim();
      const collision = await prisma.poolResource.findFirst({ where: { propertyId, code: newCode, id: { not: resourceId } } });
      if (collision) return error(`Resource code "${newCode}" already exists`, 409);
    }

    // Block deactivation or MAINTENANCE if active bookings exist
    const newStatus = body.status ? String(body.status).toUpperCase() : undefined;
    const deactivating = body.isActive === false && resource.isActive === true;
    const goingMaintenance = newStatus === 'MAINTENANCE' && resource.status !== 'MAINTENANCE';

    if (deactivating || goingMaintenance) {
      const activeBookings = await prisma.poolResourceBooking.count({
        where: { resourceId, status: { in: ['BOOKED', 'ACTIVE'] }, endAt: { gte: new Date() } },
      });
      if (activeBookings > 0) {
        const action = deactivating ? 'deactivated' : 'put into maintenance';
        return error(
          `Cannot be ${action} — ${activeBookings} active booking${activeBookings === 1 ? '' : 's'} must be resolved first.`,
          409
        );
      }
    }

    const VALID_STATUSES = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'MAINTENANCE'];
    if (newStatus && !VALID_STATUSES.includes(newStatus)) {
      return error(`status must be one of: ${VALID_STATUSES.join(', ')}`);
    }

    const VALID_TYPES = ['CABANA', 'LOUNGER', 'LOCKER', 'TOWEL'];
    const newType = body.type ? String(body.type).toUpperCase() : undefined;
    if (newType && !VALID_TYPES.includes(newType)) {
      return error(`type must be one of: ${VALID_TYPES.join(', ')}`);
    }

    const updated = await prisma.poolResource.update({
      where: { id: resourceId },
      data: {
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.code !== undefined ? { code: String(body.code).toUpperCase().trim() } : {}),
        ...(newType ? { type: newType } : {}),
        ...(newStatus ? { status: newStatus } : {}),
        ...(body.isActive !== undefined ? { isActive: Boolean(body.isActive) } : {}),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err: any) {
    if (err?.message === 'UNAUTHORIZED') return error('Unauthorized', 401);
    if (err?.code === 'P2002') return error('Resource code already exists for this property', 409);
    console.error('[POOL RESOURCE MANAGE PATCH]', err);
    return error('Internal Server Error', 500);
  }
}
