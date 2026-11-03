import { NextRequest } from 'next/server';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { createAccountDeletionRequest } from '@/lib/account-deletion-request';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const contact = String(body.contact || body.email || body.phone || '').trim();
    const fullName = String(body.fullName || '').trim();
    if (!contact || fullName.length < 2) return errorResponse('BAD_REQUEST', 'Full name and the email address or phone number registered to your LodgeCore account are required', 400);
    const isEmail = contact.includes('@');
    const staff = await prisma.staff.findMany({
      where: { isActive: true, ...(isEmail ? { email: { equals: contact.toLowerCase(), mode: 'insensitive' } } : { phone: contact }) },
      select: { id: true, email: true, firstName: true, lastName: true, propertyAccess: true },
      take: 2,
    });
    if (staff.length !== 1) return errorResponse('NOT_FOUND', staff.length > 1 ? 'More than one active account matches those details. Contact your property administrator so the correct account can be verified.' : 'We could not verify an active LodgeCore account with that email address or phone number.', 404);
    const matchedStaff = staff[0];
    const properties = await prisma.property.findMany({ where: { id: { in: matchedStaff.propertyAccess }, isActive: true }, select: { id: true } });
    if (!properties.length) return errorResponse('NOT_FOUND', 'No active property access was found for this LodgeCore account.', 404);
    const results = await Promise.all(properties.map((property) => createAccountDeletionRequest({ propertyId: property.id, staffId: matchedStaff.id, fullName, email: matchedStaff.email || (isEmail ? contact : ''), reason: String(body.reason || ''), source: 'WEB' })));
    const created = results.filter((result) => !result.duplicate);
    return successResponse({ requestIds: results.map((result) => result.request.id), status: 'PENDING', duplicate: created.length === 0, managerCount: results.reduce((total, result) => total + result.managerCount, 0), message: created.length === 0 ? 'A deletion request is already awaiting property-manager review.' : 'Your request was sent to the property manager. No data has been deleted.' }, 201);
  } catch (err: any) {
    return errorResponse('INTERNAL_ERROR', err.message || 'Unable to submit deletion request', 500);
  }
}
