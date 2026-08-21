import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { compare } from 'bcryptjs';
import { auth } from '@/lib/auth';


export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const posSessionId = resolvedParams.id;
    const { managerPin } = await req.json();

    if (!managerPin) {
      return NextResponse.json({ error: 'managerPin is required' }, { status: 400 });
    }

    const operationId = `handover_${posSessionId}`;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate session and settlement state
      const posSession = await tx.posSession.findUnique({
        where: { id: posSessionId }
      });
      if (!posSession) throw new Error('Session not found');
      
      const settlement = await tx.posSettlement.findFirst({
        where: { sessionId: posSessionId }
      });
      if (!settlement) throw new Error('No settlement found for this session');
      
      if (settlement.status !== 'PENDING_HANDOVER') {
        throw new Error(`Cannot confirm handover for settlement in ${settlement.status} state.`);
      }

      // Check idempotency
      const existingMovement = await tx.posCashMovement.findFirst({
        where: { operationId }
      });
      if (existingMovement) {
        throw new Error('This handover has already been confirmed.');
      }

      // 2. Validate Manager Authorization
      const potentialManagers = await tx.staff.findMany({
        where: {
          propertyAccess: { has: posSession.propertyId },
          isActive: true,
          posPinHash: { not: null }
        }
      });

      let manager = null;
      for (const m of potentialManagers) {
        if (m.posPinHash && (await compare(managerPin, m.posPinHash))) {
          manager = m;
          break;
        }
      }

      if (!manager) {
        throw new Error('Invalid Manager PIN or insufficient permissions.');
      }

      // 3. Resolve Cash Accounts for Double-Entry
      let sourceAccount = null;
      let movementType = 'SERVER_HANDOVER' as any;

      if (posSession.bankType === 'SERVER') {
        sourceAccount = await tx.cashAccount.findFirst({
          where: {
            propertyId: posSession.propertyId!,
            ownerId: posSession.openedBy,
            type: 'SERVER_BANK'
          }
        });
      } else if (posSession.bankType === 'CENTRAL') {
        movementType = 'STATION_HANDOVER';
        sourceAccount = await tx.cashAccount.findFirst({
          where: { propertyId: posSession.propertyId!, outletId: posSession.outletId, type: 'STATION_BANK' }
        });
      } else if (posSession.bankType === 'EMERGENCY') {
        movementType = 'EMERGENCY_HANDOVER';
        sourceAccount = await tx.cashAccount.findFirst({
          where: { propertyId: posSession.propertyId!, outletId: posSession.outletId, type: 'EMERGENCY_BANK' }
        });
      }
      
      if (!sourceAccount) {
        throw new Error(`Source CashAccount not found for bankType ${posSession.bankType}`);
      }

      // Destination = Main Property SAFE
      const destinationAccount = await tx.cashAccount.findFirst({
        where: {
          propertyId: posSession.propertyId!,
          type: 'SAFE'
        }
      });

      if (!destinationAccount) {
        throw new Error('Property SAFE account not configured.');
      }

      // 4. Create double-entry cash movement
      const movement = await tx.posCashMovement.create({
        data: {
          propertyId: posSession.propertyId!,
          deviceId: posSession.deviceId!,
          posSessionId: posSessionId,
          userId: manager.id,
          amount: settlement.actualCash,
          currency: 'NGN',
          type: movementType,
          reasonCode: 'SHIFT_HANDOVER',
          notes: `Manager handover confirmed for session ${posSessionId}`,
          authorizedBy: manager.id,
          operationId,
          sourceAccountId: sourceAccount.id,
          destinationAccountId: destinationAccount.id
        }
      });

      // Update source and destination balances
      await tx.cashAccount.update({
        where: { id: sourceAccount.id },
        data: { balance: { decrement: settlement.actualCash } }
      });
      
      await tx.cashAccount.update({
        where: { id: destinationAccount.id },
        data: { balance: { increment: settlement.actualCash } }
      });

      // 5. Update settlement and session status
      await tx.posSettlement.update({
        where: { id: settlement.id },
        data: { status: 'SETTLED' }
      });

      await tx.posSession.update({
        where: { id: posSessionId },
        data: { status: 'CLOSED' }
      });

      // 6. Create Audit Event
      await tx.posReceiptAudit.create({
        data: {
          propertyId: posSession.propertyId!,
          deviceId: posSession.deviceId || 'NO_DEVICE',
          userId: manager.id,
          type: 'REPRINT', 
          posSessionId: posSessionId,
          reason: `Shift handover confirmed and cash moved to SAFE.`,
          operationId: `audit_handover_${posSessionId}`,
          businessDate: posSession.businessDate
        }
      });

      return movement;
    });

    return NextResponse.json({ data: result });

  } catch (error: any) {
    console.error('Error in confirm-handover:', error);
    if (error.message.includes('already been confirmed') || error.message.includes('Cannot confirm handover')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error.message.includes('Invalid Manager PIN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
