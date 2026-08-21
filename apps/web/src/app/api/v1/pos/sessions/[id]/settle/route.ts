import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const posSessionId = resolvedParams.id;
    const { actualCash, operatorId, authorizerId } = await req.json();

    if (actualCash === undefined || actualCash === null) {
      return NextResponse.json({ error: 'actualCash is required' }, { status: 400 });
    }

    // Protect idempotency with a unique operation ID based on session + settle
    const operationId = `settle_${posSessionId}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate session state
      const posSession = await tx.posSession.findUnique({
        where: { id: posSessionId }
      });

      if (!posSession) {
        throw new Error('Session not found');
      }

      if (posSession.status !== 'OPEN') {
        throw new Error(`Cannot settle session in ${posSession.status} state.`);
      }

      // Check idempotency (prevent double submission)
      const existingSettlement = await tx.posSettlement.findFirst({
        where: { sessionId: posSessionId }
      });

      if (existingSettlement) {
        throw new Error('This session has already been settled.');
      }

      const expectedCash = Number(posSession.expectedCash);
      const variance = actualCash - expectedCash;

      // 2. Variance authorization rules
      if (variance !== 0) {
        if (!authorizerId) {
          throw new Error('Variance requires supervisor authorization.');
        }
        if (authorizerId === operatorId) {
          throw new Error('You cannot authorize your own variance.');
        }

        // Validate authorizer is an active staff for this property
        const authorizer = await tx.staff.findFirst({
          where: {
            id: authorizerId,
            propertyAccess: { has: posSession.propertyId },
            isActive: true
          }
        });

        if (!authorizer) {
          throw new Error('Invalid authorizer or insufficient permissions.');
        }
      }

      // 3. Update session
      // ALL bank types (SERVER, CENTRAL, EMERGENCY) require a physical handover.
      const newSessionStatus = 'RECONCILIATION_REQUIRED';
      const newSettlementStatus = 'PENDING_HANDOVER';
      
      await tx.posSession.update({
        where: { id: posSessionId },
        data: { status: newSessionStatus }
      });

      // 4. Create Settlement Record
      const settlement = await tx.posSettlement.create({
        data: {
          sessionId: posSessionId,
          propertyId: posSession.propertyId!,
          outletId: posSession.outletId,
          deviceId: posSession.deviceId || 'NO_DEVICE',
          sessionOwnerId: posSession.openedBy,
          operatorId: operatorId || session.user.id,
          businessDate: posSession.businessDate,
          expectedCash,
          actualCash,
          variance,
          authorizerId,
          settledAt: new Date(),
          status: newSettlementStatus,
          operationId
        }
      });

      // 5. Create Audit Event
      await tx.posReceiptAudit.create({
        data: {
          propertyId: posSession.propertyId!,
          deviceId: posSession.deviceId || 'NO_DEVICE',
          userId: operatorId || session.user.id,
          type: 'REPRINT',
          posSessionId: posSessionId,
          reason: `Session Settled. Expected: ${expectedCash}, Actual: ${actualCash}, Variance: ${variance}`,
          operationId: `audit_settle_${posSessionId}`,
          businessDate: posSession.businessDate
        }
      });

      return settlement;
    });

    return NextResponse.json({ data: result });

  } catch (error: any) {
    console.error('Error in settle session:', error);
    if (error.message.includes('already been settled') || error.message.includes('Cannot settle session')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error.message.includes('Variance requires') || error.message.includes('authorize your own') || error.message.includes('Invalid authorizer')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
