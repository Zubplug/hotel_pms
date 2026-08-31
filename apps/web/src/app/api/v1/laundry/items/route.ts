import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';
import { hasPermission } from '@/lib/rbac';
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const category = searchParams.get('category');
    const allowedProperties = (await requireOrganizationContext(session.user.id)).propertyIds as string[];
    if (!allowedProperties.length) return successResponse([]);
    if (propertyId && !allowedProperties.includes(propertyId)) {
        return errorResponse('FORBIDDEN', 'Access denied to property', 403);
    }
    const items = await prisma.laundryItem.findMany({
      where: {
        propertyId: {
          in: propertyId ? [propertyId] : allowedProperties
        },
        isActive: true,
        ...(category ? { category } : {})
      },
      orderBy: { name: 'asc' }
    });
    return successResponse(items);
  } catch (err) {
    console.error('[LaundryItems GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to fetch laundry items', 500);
  }
}
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const body = await req.json();
    const { propertyId, name, category, description, basePrice, currency, servicePricingRules } = body;
    if (!propertyId || !name || basePrice === undefined) {
      return errorResponse('BAD_REQUEST', 'Missing required fields', 400);
    }
    const canManage = await hasPermission(session.user.id, 'laundry', 'create', propertyId);
    if (!canManage) return errorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    const item = await prisma.laundryItem.create({
      data: {
        propertyId,
        name,
        category,
        description,
        basePrice,
        currency: currency || 'NGN',
        servicePricingRules: servicePricingRules || {}
      }
    });
    return successResponse(item, 201);
  } catch (err) {
    console.error('[LaundryItems POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Failed to create laundry item', 500);
  }
}
