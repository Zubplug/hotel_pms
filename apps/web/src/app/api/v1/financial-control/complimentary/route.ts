import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';
import { resolveUser } from '@/lib/resolve-user';

export async function GET(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const businessDate = searchParams.get('businessDate');
    const status = searchParams.get('status');

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    
    const ctx = await requireOrganizationContext(user.id);
    if (!ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);

    const whereClause: any = { propertyId };
    if (businessDate) whereClause.businessDate = new Date(businessDate);
    if (status) whereClause.status = status;

    const records = await prisma.complimentaryRecord.findMany({
      where: whereClause,
      include: {
        operator: { select: { firstName: true, lastName: true } },
        staff: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' }
    });

    return successResponse({ records });
  } catch (err: any) {
    console.error('[Complimentary GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { id, propertyId, status, rejectionReason, nightAuditorId } = body;

    if (!id || !propertyId || !status) return errorResponse('BAD_REQUEST', 'Missing required fields', 400);

    const ctx = await requireOrganizationContext(user.id);
    if (!ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);
    if (!['NIGHT_AUDITOR', 'MANAGER', 'ADMIN', 'SUPER_ADMIN'].includes(user.role) && !user.isSuperAdmin) return errorResponse('FORBIDDEN', 'Night Auditor access required', 403);
    if (!['VERIFIED', 'UNRESOLVED', 'REVERSED'].includes(status)) return errorResponse('BAD_REQUEST', 'Invalid complimentary status', 400);
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { organizationId: true } });
    const auditor = await prisma.staff.findFirst({ where: { userId: user.id, organizationId: property?.organizationId, isActive: true }, select: { id: true } });
    if (!auditor) return errorResponse('FORBIDDEN', 'Authenticated user has no active staff profile', 403);

    const record = await prisma.complimentaryRecord.update({
      where: { id, propertyId },
      data: {
        status,
        rejectionReason: rejectionReason || null,
        approverId: status === 'VERIFIED' ? auditor.id : null,
        nightAuditorId: status === 'VERIFIED' ? auditor.id : null,
        verifiedAt: status === 'VERIFIED' ? new Date() : null,
      },
      include: {
        operator: { select: { firstName: true, lastName: true } },
        staff: { select: { firstName: true, lastName: true } },
      }
    });

    return successResponse({ record });
  } catch (err: any) {
    console.error('[Complimentary PATCH]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
