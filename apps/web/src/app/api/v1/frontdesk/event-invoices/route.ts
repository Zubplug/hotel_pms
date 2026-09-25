import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { errorResponse, successResponse } from '@/lib/api-response';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const propertyId = req.nextUrl.searchParams.get('propertyId');
    const search = req.nextUrl.searchParams.get('search')?.trim() || '';
    if (!propertyId) return errorResponse('BAD_REQUEST', 'propertyId is required', 400);

    const context = await requireOrganizationContext(session.user.id);
    if (!context.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);

    const invoices = await prisma.eventInvoice.findMany({
      where: {
        event: {
          propertyId,
          ...(search ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { contactName: { contains: search, mode: 'insensitive' } },
              { contactPhone: { contains: search, mode: 'insensitive' } },
              { contactEmail: { contains: search, mode: 'insensitive' } },
              { guest: { OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
              ] } },
              { corporateAccount: { name: { contains: search, mode: 'insensitive' } } },
            ],
          } : {}),
        },
        status: { in: ['UNPAID', 'PARTIAL'] },
      },
      include: {
        event: { include: { guest: true, corporateAccount: true } },
        folio: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });

    return successResponse(invoices);
  } catch (error) {
    console.error('[Frontdesk Event Invoices GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Unable to load event invoices', 500);
  }
}
