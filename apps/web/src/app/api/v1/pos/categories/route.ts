import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { requireOrganizationContext } from "@/lib/organization-access";

const MENU_ROLES = ['FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER', 'GENERAL_MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'CEO', 'SUPER_ADMIN'];

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    const ctx = await requireOrganizationContext((session.user as any).id || (session as any).user.id);

    const url = new URL(req.url);
    const propertyId = url.searchParams.get('propertyId');
    const outletId = url.searchParams.get('outletId');
    if (!propertyId) return errorResponse('BAD_REQUEST', 'Property ID is required', 400);

    let outletIdsToQuery = [];
    if (outletId) {
      const outlet = await prisma.posOutlet.findFirst({ where: { id: outletId, propertyId, isActive: true }, select: { id: true } });
      if (!outlet) return errorResponse('FORBIDDEN', 'No access to this outlet', 403);
      outletIdsToQuery = [outlet.id];
    } else {
      // Categories are linked via outlet. Let's get outlets for this property first, then categories.
      if (!ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);
      const outlets = await prisma.posOutlet.findMany({
        where: { propertyId, isActive: true },
        select: { id: true }
      });
      outletIdsToQuery = outlets.map((o: any) => o.id);
    }

    const categories = await prisma.productCategory.findMany({
      where: { outletId: { in: outletIdsToQuery }, ...(new URL(req.url).searchParams.get('all') === 'true' ? {} : { isActive: true }) },
      orderBy: { sortOrder: 'asc' }
    });

    return successResponse(categories);
  } catch (err) {
    console.error('[POS Categories GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const userId = (session.user as any).id;
    if (!MENU_ROLES.includes((session.user as any).role) && !(session.user as any).isSuperAdmin) return errorResponse('FORBIDDEN', 'F&B management access required', 403);
    const ctx = await requireOrganizationContext(userId);
    const body = await req.json();
    const propertyId = String(body.propertyId || '');
    const outletId = String(body.outletId || '');
    const name = String(body.name || '').trim();
    if (!propertyId || !ctx.propertyIds.includes(propertyId) || !outletId || !name) return errorResponse('BAD_REQUEST', 'Property, outlet, and category name are required', 400);
    const outlet = await prisma.posOutlet.findFirst({ where: { id: outletId, propertyId, isActive: true }, select: { id: true } });
    if (!outlet) return errorResponse('BAD_REQUEST', 'Select a valid outlet for this property', 400);
    const duplicate = await prisma.productCategory.findFirst({ where: { outletId, name: { equals: name, mode: 'insensitive' } } });
    if (duplicate) return errorResponse('CONFLICT', 'A category with this name already exists', 409);
    const category = await prisma.productCategory.create({ data: { outletId, name, productionStation: body.productionStation || 'KITCHEN', fnbClass: body.fnbClass || 'OTHER' } });
    return successResponse(category, 201);
  } catch (err) {
    console.error('[POS Categories POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Unable to create category', 500);
  }
}
