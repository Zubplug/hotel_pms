import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

// GET /api/v1/frontdesk/sessions
// Fetch all sessions (optionally filtered by status, staff, property, etc)
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);

    const url = new URL(req.url);
    const propertyId = url.searchParams.get('propertyId');
    const status = url.searchParams.get('status');
    const staffId = url.searchParams.get('staffId');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);

    if (!propertyId) return errorResponse('BAD_REQUEST', 'Property ID is required', 400);

    const whereClause: any = { propertyId };
    if (status) whereClause.status = status;
    if (staffId) whereClause.staffId = staffId;

    const sessions = await prisma.frontdeskSession.findMany({
      where: whereClause,
      include: {
        staff: { select: { id: true, firstName: true, lastName: true } },
        cashAccount: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    return successResponse({ sessions });
  } catch (err) {
    console.error('[Frontdesk Sessions GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}

// POST /api/v1/frontdesk/sessions
// Open a new Frontdesk Session
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);

    const { propertyId, cashAccountId, openingFloat } = await req.json();

    if (!propertyId || !cashAccountId) {
      return errorResponse('BAD_REQUEST', 'Property ID and Cash Account ID are required', 400);
    }

    const staff = await prisma.staff.findFirst({ where: { userId: session.user.id } });
    if (!staff) return errorResponse('UNAUTHORIZED', 'Staff record not found', 401);

    // Concurrency / Rules Check
    // 1. Check if this staff already has an open session
    const existingStaffSession = await prisma.frontdeskSession.findFirst({
      where: { staffId: staff.id, status: 'OPEN' }
    });
    if (existingStaffSession) {
      return errorResponse('CONFLICT', 'Staff already has an open session', 409);
    }

    // 2. Check if the till (CashAccount) is already used by an open session
    const existingTillSession = await prisma.frontdeskSession.findFirst({
      where: { cashAccountId, status: 'OPEN' }
    });
    if (existingTillSession) {
      return errorResponse('CONFLICT', 'Till is already in use by another open session', 409);
    }

    // 3. Get property business date
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    let businessDate = property.businessDate;
    if (!businessDate) {
      const tz = property.timezone || 'Africa/Lagos';
      const todayString = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
      businessDate = new Date(`${todayString}T00:00:00.000Z`);
    }

    // Generate shift reference (e.g. FD-20260824-UUID)
    const shortUuid = crypto.randomUUID().split('-')[0].toUpperCase();
    const dateStr = businessDate.toISOString().split('T')[0].replace(/-/g, '');
    const shiftReference = `FD-${dateStr}-${shortUuid}`;

    const floatValue = openingFloat ? parseFloat(openingFloat) : 0;

    // Execute in a transaction to ensure integrity
    const newSession = await prisma.$transaction(async (tx) => {
      const createdSession = await tx.frontdeskSession.create({
        data: {
          propertyId,
          staffId: staff.id,
          cashAccountId,
          shiftReference,
          businessDate,
          status: 'OPEN',
          openingFloat: floatValue,
          systemExpectedCash: floatValue
        }
      });

      // Log opening float movement if provided
      if (floatValue > 0) {
        await tx.posCashMovement.create({
          data: {
            propertyId,
            deviceId: 'SYSTEM',
            userId: staff.id,
            amount: floatValue,
            currency: property.baseCurrency || 'NGN',
            type: 'OPENING_FLOAT',
            sourceAccountId: cashAccountId, // In a real system, might come from a safe
            destinationAccountId: cashAccountId,
            reasonCode: 'OPEN_SHIFT',
            operationId: `FLOAT-${createdSession.id}`,
            businessDate: businessDate,
            frontdeskSessionId: createdSession.id,
          }
        });
      }

      // Log audit
      await tx.frontdeskSessionAudit.create({
        data: {
          frontdeskSessionId: createdSession.id,
          action: 'OPENED',
          performedBy: staff.id,
          notes: `Shift opened with float ${floatValue}`
        }
      });

      return createdSession;
    });

    return successResponse({ session: newSession });
  } catch (err) {
    console.error('[Frontdesk Sessions POST]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
