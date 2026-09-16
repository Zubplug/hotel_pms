import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { errorResponse, successResponse } from '@/lib/api-response';

const MANAGER_ROLES = ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'CEO', 'SUPER_ADMIN'];
const WAITER_POSITIONS = ['WAITER', 'WAITRESS'];

async function authorize(req: NextRequest) {
  const user = await resolveUser(req);
  if (!user) return { error: errorResponse('UNAUTHORIZED', 'Authentication required', 401) };
  if (!MANAGER_ROLES.includes(user.role) && !user.isSuperAdmin) return { error: errorResponse('FORBIDDEN', 'F&B manager access required', 403) };
  const ctx = await requireOrganizationContext(user.id);
  const propertyId = req.nextUrl.searchParams.get('propertyId');
  if (!propertyId || (!ctx.propertyIds.includes(propertyId) && !user.isSuperAdmin)) return { error: errorResponse('FORBIDDEN', 'No access to this property', 403) };
  return { user, ctx, propertyId };
}

export async function GET(req: NextRequest) {
  const access = await authorize(req);
  if ('error' in access) return access.error;
  const { propertyId, ctx } = access;
  const [outlets, staff] = await Promise.all([
    prisma.posOutlet.findMany({ where: { propertyId, isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.staff.findMany({
      where: { organizationId: ctx.organizationId, propertyAccess: { has: propertyId }, isActive: true, position: { in: WAITER_POSITIONS }, department: { in: ['F&B', 'Food & Beverage', 'Kitchen', 'Bar', 'Restaurant'] } },
      select: { id: true, firstName: true, lastName: true, position: true, outletAccess: { where: { outlet: { propertyId } }, select: { outletId: true } } },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
  ]);
  return successResponse({ outlets, staff });
}

export async function PUT(req: NextRequest) {
  const access = await authorize(req);
  if ('error' in access) return access.error;
  const { propertyId, user } = access;
  const body = await req.json();
  const staffId = String(body.staffId || '');
  const outletIds: string[] = Array.isArray(body.outletIds) ? [...new Set<string>(body.outletIds.map((id: unknown) => String(id)).filter(Boolean))] : [];
  if (!staffId) return errorResponse('BAD_REQUEST', 'Staff member is required', 400);
  const [staff, outlets] = await Promise.all([
    prisma.staff.findFirst({ where: { id: staffId, propertyAccess: { has: propertyId }, isActive: true, position: { in: WAITER_POSITIONS } }, select: { id: true } }),
    prisma.posOutlet.findMany({ where: { id: { in: outletIds }, propertyId, isActive: true }, select: { id: true } }),
  ]);
  if (!staff) return errorResponse('NOT_FOUND', 'Staff member not found for this property', 404);
  if (outlets.length !== outletIds.length) return errorResponse('BAD_REQUEST', 'One or more outlets are invalid for this property', 400);
  await prisma.$transaction(async (tx) => {
    await tx.staffPosOutletAccess.deleteMany({ where: { staffId, outlet: { propertyId } } });
    if (outletIds.length) await tx.staffPosOutletAccess.createMany({ data: outletIds.map((outletId) => ({ staffId, outletId, assignedBy: user.id })) });
    // Outlet access is embedded in the Staff sync projection. Touch the staff
    // record so incremental desktop syncs cannot miss an access-only change.
    await tx.staff.update({ where: { id: staffId }, data: { updatedAt: new Date() } });
  });
  return successResponse({ staffId, outletIds });
}
