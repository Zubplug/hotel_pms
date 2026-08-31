import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { compare } from 'bcryptjs';
import { auth } from '@/lib/auth';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pin, reason, deviceId, outletId } = await req.json();

    if (!pin || !reason || !deviceId || !outletId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Determine property ID either from authenticated user or request payload
    const propertyId = (session.user as any).propertyId;
    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID missing from session context' }, { status: 400 });
    }
    if (await isNightAuditTransactionLocked(propertyId)) {
      return NextResponse.json({ error: 'Night audit cutover is in progress. Emergency POS banks cannot be opened until the new business date is active.', code: 'NIGHT_AUDIT_IN_PROGRESS' }, { status: 409 });
    }

    // Deep Authorization: Check Manager permissions for this property
    const potentialManagers = await prisma.staff.findMany({
      where: {
        propertyAccess: { has: propertyId },
        isActive: true,
        posPinHash: { not: null }
      }
    });

    let manager = null;
    for (const m of potentialManagers) {
      if (m.posPinHash && (await compare(pin, m.posPinHash))) {
        manager = m;
        break;
      }
    }

    if (!manager) {
      return NextResponse.json({ error: 'Invalid Manager PIN or insufficient permissions' }, { status: 403 });
    }

    // Strict Postgres Transaction
    const result = await prisma.$transaction(async (tx) => {
      // Ensure an EMERGENCY_BANK CashAccount exists for this property/outlet
      let emergencyBank = await tx.cashAccount.findFirst({
        where: {
          propertyId,
          outletId,
          type: 'EMERGENCY_BANK'
        }
      });

      if (!emergencyBank) {
        emergencyBank = await tx.cashAccount.create({
          data: { propertyId,
            outletId,
            name: 'Emergency Manager Bank',
            type: 'EMERGENCY_BANK',
            isActive: true
          }
        });
      }

      // Check if there's already an active emergency session for this device
      const existingSession = await tx.posSession.findFirst({
        where: {
          deviceId,
          status: 'OPEN',
          bankType: 'EMERGENCY'
        }
      });

      if (existingSession) {
        throw new Error('An emergency bank is already active on this terminal.');
      }

      // Create new session linked      // 3. Create POS Session for Manager
      const newSession = await tx.posSession.create({
        data: { propertyId,
          deviceId,
          outlet: { connect: { id: outletId } },
          bankingModel: 'CENTRAL_CASHIER',
          openedBy: manager.id,
          status: 'OPEN',
          openingCash: 0,
          expectedCash: 0,
          businessDate: (await tx.property.findUnique({ where: { id: propertyId }, select: { businessDate: true } }))?.businessDate || getPropertyBusinessDate(),
          bankType: 'EMERGENCY'
        }
      });

      // Optional: Log emergency audit event
      await tx.posReceiptAudit.create({
        data: { propertyId,
          deviceId,
          userId: manager.id,
          type: 'REPRINT',
          posSessionId: newSession.id,
          reason: `Emergency Bank created for Manager ${manager.id}. Reason: ${reason}`,
          operationId: `audit_emergency_bank_${newSession.id}`,
          businessDate: newSession.businessDate
        }
      });

      return newSession;
    });

    return NextResponse.json({ data: { sessionId: result.id } });

  } catch (error: any) {
    console.error('Error in emergency-bank:', error);
    if (error.message.includes('already active')) {
       return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
