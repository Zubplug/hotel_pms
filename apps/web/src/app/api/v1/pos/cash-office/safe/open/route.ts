import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { compare } from 'bcryptjs';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from "@/lib/organization-access";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { propertyId, amount, managerPin } = await req.json();

    if (!propertyId || amount === undefined || !managerPin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const operationId = `safe_open_${crypto.randomUUID()}`; // Unique operation ID

    const result = await prisma.$transaction(async (tx) => {
      // 1. Validate Manager Authorization
      const potentialManagers = await tx.staff.findMany({
        where: {
          propertyAccess: { has: propertyId },
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

      // 2. Get or Create SAFE and EXTERNAL accounts
      let safeAccount = await tx.cashAccount.findFirst({
        where: { propertyId, type: 'SAFE' }
      });

      if (!safeAccount) {
        safeAccount = await tx.cashAccount.create({
          data: { propertyId, name: 'Main Property Safe', type: 'SAFE', isActive: true }
        });
      }

      let externalAccount = await tx.cashAccount.findFirst({
        where: { propertyId, type: 'EXTERNAL' }
      });

      if (!externalAccount) {
        externalAccount = await tx.cashAccount.create({
          data: { propertyId, name: 'External Funds', type: 'EXTERNAL', isActive: true }
        });
      }

      // 3. Create Movement
      const movement = await tx.posCashMovement.create({
        data: { propertyId,
          deviceId: 'web-browser-cash-office',
          userId: manager.id,
          amount: amount,
          currency: 'NGN',
          type: 'CASH_TRANSFER_IN',
          reasonCode: 'SAFE_OPEN',
          notes: `Initial safe balance recorded by manager`,
          authorizedBy: manager.id,
          operationId,
          sourceAccountId: externalAccount.id,
          destinationAccountId: safeAccount.id
        }
      });

      // 4. Update balances
      await tx.cashAccount.update({
        where: { id: externalAccount.id },
        data: { balance: { decrement: amount } }
      });

      await tx.cashAccount.update({
        where: { id: safeAccount.id },
        data: { balance: { increment: amount } }
      });

      return movement;
    });

    return NextResponse.json({ data: result });

  } catch (error: any) {
    console.error('Error in safe/open:', error);
    if (error.message.includes('Invalid Manager PIN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
