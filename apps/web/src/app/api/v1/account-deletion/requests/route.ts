import { NextRequest } from 'next/server';
import { errorResponse, successResponse } from '@/lib/api-response';
import { resolveUser } from '@/lib/resolve-user';
import { createAccountDeletionRequest } from '@/lib/account-deletion-request';
import prisma from '@hotel-pms/db';

export async function POST(req: NextRequest) {
  try {
    const user = await resolveUser(req);
    if (!user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const body = await req.json();
    const propertyId = String(body.propertyId || '');
    if (!propertyId || !user.allowedProperties.includes(propertyId)) return errorResponse('FORBIDDEN', 'You do not have access to this property', 403);
    const staff = await prisma.staff.findFirst({ where: { OR: [{ userId: user.id }, { id: user.id }, ...(user.email ? [{ email: { equals: user.email, mode: 'insensitive' as const } }] : [])], propertyAccess: { has: propertyId }, isActive: true }, select: { id: true, firstName: true, lastName: true, email: true, phone: true } });
    if (!staff) return errorResponse('FORBIDDEN', 'Your active staff profile could not be found', 403);
    const result = await createAccountDeletionRequest({ propertyId, staffId: staff.id, fullName: (staff.firstName + ' ' + staff.lastName).trim(), email: staff.email || user.email || staff.phone || '', reason: String(body.reason || ''), source: 'MOBILE_APP' });
    return successResponse({ requestId: result.request.id, status: result.request.status, duplicate: result.duplicate, managerCount: result.managerCount, message: result.duplicate ? 'A deletion request is already awaiting property-manager review.' : 'Your deletion request was sent to the property manager. No data has been deleted.' }, 201);
  } catch (err: any) {
    if (err.message === 'STAFF_NOT_FOUND') return errorResponse('FORBIDDEN', 'Your active staff profile could not be found', 403);
    return errorResponse('INTERNAL_ERROR', err.message || 'Unable to submit deletion request', 500);
  }
}
