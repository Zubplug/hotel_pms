import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { resolveUser } from '@/lib/resolve-user';
import { requireOrganizationContext } from '@/lib/organization-access';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

/**
 * Returns the immutable evidence package created when a Night Audit completes.
 * The report manifest points to the existing report routes while the package
 * itself preserves the close totals, controls, journal references and hash.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const user: any = session?.user || await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const allowedRoles = ['NIGHT_AUDITOR', 'ACCOUNTANT', 'MANAGER', 'HOTEL_MANAGER', 'ADMIN', 'SUPER_ADMIN', 'CEO', 'FINANCE_MANAGER', 'GENERAL_CASHIER'];
    if (!allowedRoles.includes(String(user.role || '').toUpperCase())) return errorResponse('FORBIDDEN', 'Insufficient permissions to view close evidence', 403);

    const propertyId = req.nextUrl.searchParams.get('propertyId');
    const businessDate = req.nextUrl.searchParams.get('businessDate');
    if (!propertyId || !businessDate) return errorResponse('BAD_REQUEST', 'Missing propertyId or businessDate', 400);

    const context = await requireOrganizationContext(user.id);
    if (!context.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'No access to this property', 403);

    const date = new Date(`${businessDate}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return errorResponse('BAD_REQUEST', 'Invalid businessDate', 400);

    const audit = await prisma.nightAudit.findUnique({
      where: { propertyId_businessDate: { propertyId, businessDate: date } },
      select: { id: true, businessDate: true, status: true, completedAt: true },
    });
    if (!audit) return errorResponse('NOT_FOUND', 'Night Audit not found for this business date', 404);

    const closePackage = await prisma.nightAuditClosePackage.findUnique({
      where: { nightAuditId: audit.id },
    });
    if (!closePackage) return errorResponse('NOT_FOUND', 'No final close package exists for this audit', 404);

    return successResponse({ audit, closePackage });
  } catch (error: any) {
    console.error('[Night Audit Close Package GET]', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Unable to load close package', 500);
  }
}
