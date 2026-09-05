import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const businessDate = searchParams.get('businessDate');
    const status = searchParams.get('status');

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    
    const ctx = await requireOrganizationContext(session.user.id);
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
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const body = await req.json();
    const { id, propertyId, status, rejectionReason, nightAuditorId } = body;

    if (!id || !propertyId || !status) return errorResponse('BAD_REQUEST', 'Missing required fields', 400);

    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);

    const record = await prisma.complimentaryRecord.update({
      where: { id, propertyId },
      data: {
        status,
        rejectionReason: rejectionReason || null,
        nightAuditorId,
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
