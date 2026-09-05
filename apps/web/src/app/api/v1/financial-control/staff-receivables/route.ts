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
    const status = searchParams.get('status');
    const staffId = searchParams.get('staffId');

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Missing propertyId', 400);
    
    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'Forbidden', 403);

    const whereClause: any = { propertyId };
    if (status) whereClause.status = status;
    if (staffId) whereClause.staffId = staffId;

    const records = await prisma.staffReceivable.findMany({
      where: whereClause,
      include: {
        staff: { select: { firstName: true, lastName: true, department: true } },
        settlements: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return successResponse({ records });
  } catch (err: any) {
    console.error('[StaffReceivables GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
