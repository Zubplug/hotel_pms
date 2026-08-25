import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    const url = new URL(req.url);
    const propertyId = url.searchParams.get('propertyId');
    if (!propertyId) return errorResponse('BAD_REQUEST', 'Property ID is required', 400);
    const status = url.searchParams.get('status') || undefined;
    const staffId = url.searchParams.get('staffId') || undefined;
    const sessions = await prisma.frontdeskSession.findMany({
      where: { propertyId, status: status as any, staffId },
      include: { staff: { select: { id: true, firstName: true, lastName: true } }, cashAccount: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Number(url.searchParams.get('limit') || 50), 200),
    });
    return successResponse({ sessions });
  } catch (error) {
    console.error('[Frontdesk Sessions GET]', error);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);
    const { propertyId, cashAccountId, openingFloat = 0, deviceId = 'FRONT_DESK' } = await req.json();
    if (!propertyId || !cashAccountId) return errorResponse('BAD_REQUEST', 'Property ID and cash account ID are required', 400);
    const staff = await prisma.staff.findFirst({ where: { userId: session.user.id } });
    if (!staff) return errorResponse('UNAUTHORIZED', 'Staff record not found', 401);
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);
    const businessDate = property.businessDate || new Date(new Intl.DateTimeFormat('en-CA', { timeZone: property.timezone || 'Africa/Lagos' }).format(new Date()) + 'T00:00:00.000Z');
    const floatValue = Number(openingFloat) || 0;
    const shiftReference = `FD-${businessDate.toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const created = await prisma.$transaction(async tx => {
      const existingStaff = await tx.frontdeskSession.findFirst({ where: { staffId: staff.id, status: { in: ['OPEN', 'CLOSING'] } } });
      if (existingStaff) throw new Error('STAFF_SESSION_EXISTS');
      const existingTill = await tx.frontdeskSession.findFirst({ where: { cashAccountId, status: { in: ['OPEN', 'CLOSING'] } } });
      if (existingTill) throw new Error('TILL_SESSION_EXISTS');
      const frontdeskSession = await tx.frontdeskSession.create({ data: { propertyId, staffId: staff.id, cashAccountId, shiftReference, businessDate, openingFloat: floatValue, systemExpectedCash: floatValue } });
      if (floatValue > 0) {
        await tx.posCashMovement.create({ data: { propertyId, deviceId, frontdeskSessionId: frontdeskSession.id, userId: staff.id, amount: floatValue, currency: property.baseCurrency, type: 'OPENING_FLOAT', sourceAccountId: cashAccountId, destinationAccountId: cashAccountId, reasonCode: 'OPEN_SHIFT', operationId: `FLOAT-${frontdeskSession.id}`, businessDate } });
      }
      await tx.frontdeskSessionAudit.create({ data: { frontdeskSessionId: frontdeskSession.id, action: 'OPENED', performedBy: staff.id, notes: `Shift opened with float ${floatValue}` } });
      return frontdeskSession;
    });
    return successResponse({ session: created });
  } catch (error) {
    if (error instanceof Error && error.message === 'STAFF_SESSION_EXISTS') return errorResponse('CONFLICT', 'Staff already has an open session', 409);
    if (error instanceof Error && error.message === 'TILL_SESSION_EXISTS') return errorResponse('CONFLICT', 'Till is already in use by another open session', 409);
    console.error('[Frontdesk Sessions POST]', error);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
