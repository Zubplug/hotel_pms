import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { compare } from 'bcryptjs';
import { auth } from '@/lib/auth';

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
    const result = await prisma.$transaction(async (tx: any) => {
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
          data: {
            propertyId,
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

      // Create new session linked to this emergency bank account
      const posSession = await tx.posSession.create({
        data: {
          propertyId,
          outletId,
          deviceId,
          openedBy: manager.id,
          status: 'OPEN',
          openingCash: 0,
          expectedCash: 0,
          businessDate: new Date(),
          bankType: 'EMERGENCY'
        }
      });

      // Optional: Log emergency audit event
      await tx.posReceiptAudit.create({
        data: {
          propertyId,
          deviceId,
          userId: manager.id,
          receiptType: 'REPRINT', // Mocking audit action type for general log
          originalOrderId: posSession.id, 
          reason: `Emergency Bank Opened: ${reason}`
        }
      });

      return posSession;
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
