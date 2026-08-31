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

    const { propertyId, amount, reference, managerPin } = await req.json();

    if (!propertyId || amount === undefined || !managerPin) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const operationId = `safe_deposit_${crypto.randomUUID()}`;

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

      // 2. Get SAFE and BANK_ACCOUNT accounts
      const safeAccount = await tx.cashAccount.findFirst({
        where: { propertyId, type: 'SAFE' }
      });

      if (!safeAccount) {
        throw new Error('Property SAFE account not found.');
      }

      if (Number(safeAccount.balance) < amount) {
        throw new Error('Insufficient funds in the SAFE to make this deposit.');
      }

      let bankAccount = await tx.cashAccount.findFirst({
        where: { propertyId, type: 'BANK_ACCOUNT' }
      });

      if (!bankAccount) {
        bankAccount = await tx.cashAccount.create({
          data: { propertyId, name: 'Main Corporate Bank Account', type: 'BANK_ACCOUNT', isActive: true }
        });
      }

      // 3. Create Movement
      const movement = await tx.posCashMovement.create({
        data: { propertyId,
          deviceId: 'web-browser-cash-office',
          userId: manager.id,
          amount: amount,
          currency: 'NGN',
          type: 'CASH_TRANSFER_OUT',
          reasonCode: 'BANK_DEPOSIT',
          notes: `Bank Deposit Reference: ${reference || 'N/A'}`,
          receiptReference: reference,
          authorizedBy: manager.id,
          operationId,
          sourceAccountId: safeAccount.id,
          destinationAccountId: bankAccount.id
        }
      });

      // 4. Update balances
      await tx.cashAccount.update({
        where: { id: safeAccount.id },
        data: { balance: { decrement: amount } }
      });

      await tx.cashAccount.update({
        where: { id: bankAccount.id },
        data: { balance: { increment: amount } }
      });

      return movement;
    });

    return NextResponse.json({ data: result });

  } catch (error: any) {
    console.error('Error in safe/deposit:', error);
    if (error.message.includes('Invalid Manager PIN')) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error.message.includes('Insufficient funds') || error.message.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
