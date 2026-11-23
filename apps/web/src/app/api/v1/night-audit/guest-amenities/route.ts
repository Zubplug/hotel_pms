import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { errorResponse, successResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';
import { fulfilGuestAmenityShortage, waiveGuestAmenityShortage } from '@/lib/services/guest-amenity-service';
import crypto from 'crypto';

async function authorize(userId: string, propertyId: string, role?: string) {
  const context = await requireOrganizationContext(userId);
  if (!context.propertyIds.includes(propertyId)) return false;
  return ['INVENTORY_MANAGER', 'STOCK_MANAGER', 'STOCK_KEEPER', 'HOUSEKEEPING_MANAGER', 'HOUSEKEEPING_MAINTENANCE_MANAGER'].includes(String(role || '').toUpperCase());
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const propertyId = req.nextUrl.searchParams.get('propertyId');
    let businessDate = req.nextUrl.searchParams.get('businessDate');
    if (!propertyId) return errorResponse('BAD_REQUEST', 'propertyId is required', 400);
    if (!(await authorize(session.user.id, propertyId, (session.user as any).role))) return errorResponse('FORBIDDEN', 'Night Audit access denied', 403);

    if (!businessDate) {
      const latestAudit = await prisma.nightAudit.findFirst({
        where: { propertyId, status: 'COMPLETED' },
        orderBy: [{ businessDate: 'desc' }, { completedAt: 'desc' }],
        select: { businessDate: true },
      });
      businessDate = latestAudit?.businessDate ? new Date(latestAudit.businessDate).toISOString().slice(0, 10) : null;
    }
    if (!businessDate || !/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) return errorResponse('BAD_REQUEST', 'No completed Night Audit is available', 400);

    // Close rows for guests who have departed since the audit. This keeps the
    // operational queue truthful without allowing a stale line to be issued.
    await prisma.guestAmenityFulfillment.updateMany({
      where: {
        propertyId,
        businessDate: new Date(`${businessDate}T00:00:00.000Z`),
        status: { in: ['PENDING', 'PARTIALLY_FULFILLED'] },
        voidedAt: null,
        reservation: { status: { not: 'CHECKED_IN' } },
      },
      data: { status: 'VOIDED', reason: 'Voided because the guest is no longer checked in.', voidedAt: new Date() },
    });

    const rows = await prisma.guestAmenityFulfillment.findMany({
      where: {
        propertyId,
        businessDate: new Date(`${businessDate}T00:00:00.000Z`),
        status: { in: ['PENDING', 'PARTIALLY_FULFILLED'] },
        voidedAt: null,
        reservation: { status: 'CHECKED_IN' },
      },
      orderBy: [{ status: 'asc' }, { amenityName: 'asc' }, { createdAt: 'asc' }],
      include: {
        reservation: { select: { confirmationNumber: true, primaryGuest: { select: { firstName: true, lastName: true } } } },
        room: { select: { number: true } },
      },
    });
    return successResponse({ businessDate, items: rows });
  } catch (error: any) {
    console.error('[Guest Amenity Queue GET]', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Unable to load guest amenity queue', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);
    const body = await req.json();
    const { propertyId, fulfillmentId, action, reason } = body;
    if (!propertyId || !fulfillmentId || !['FULFIL', 'WAIVE'].includes(action)) return errorResponse('BAD_REQUEST', 'propertyId, fulfillmentId, and action are required', 400);
    if (!(await authorize(session.user.id, propertyId, (session.user as any).role))) return errorResponse('FORBIDDEN', 'Night Audit access denied', 403);

    const existing = await prisma.guestAmenityFulfillment.findUnique({ where: { id: fulfillmentId }, select: { propertyId: true } });
    if (!existing || existing.propertyId !== propertyId) return errorResponse('NOT_FOUND', 'Guest amenity fulfilment not found', 404);

    const result = await prisma.$transaction(async (tx) => {
      const updated = action === 'FULFIL'
        ? await fulfilGuestAmenityShortage(tx, fulfillmentId, session.user.id)
        : await waiveGuestAmenityShortage(tx, fulfillmentId, session.user.id, String(reason || ''));
      await tx.auditLog.create({
        data: {
          organizationId: (session.user as any).organizationId || (await tx.property.findUnique({ where: { id: propertyId }, select: { organizationId: true } }))?.organizationId || '',
          propertyId,
          userId: session.user.id,
          userEmail: session.user.email || 'unknown@system.local',
          userRole: (session.user as any).role || 'SYSTEM',
          action: action === 'FULFIL' ? 'GUEST_AMENITY_FULFILLED' : 'GUEST_AMENITY_WAIVED',
          resource: 'GuestAmenityFulfillment',
          resourceId: fulfillmentId,
          newValue: { action, reason: reason || null },
          ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
          userAgent: req.headers.get('user-agent') || 'SYSTEM',
          requestId: crypto.randomUUID(),
        },
      });
      return updated;
    });
    return successResponse({ item: result });
  } catch (error: any) {
    console.error('[Guest Amenity Queue POST]', error);
    const message = error instanceof Error ? error.message : String(error);
    const status = message.startsWith('NOT_FOUND:') ? 404 : message.startsWith('CONFLICT:') ? 409 : 400;
    return errorResponse(message.split(':')[0] || 'BAD_REQUEST', message.replace(/^[A-Z_]+:/, ''), status);
  }
}
