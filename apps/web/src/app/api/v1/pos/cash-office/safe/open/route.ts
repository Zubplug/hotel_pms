import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';


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

    const result = await prisma.$transaction(async (tx: any) => {
      // 1. Validate Manager Authorization
      const manager = await tx.staff.findFirst({
        where: {
          propertyId,
          pin: managerPin,
          isActive: true,
          OR: [
            { role: 'HOTEL_MANAGER' },
            { role: 'SUPER_ADMIN' },
            { isSupervisor: true }
          ]
        }
      });

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
        data: {
          propertyId,
          deviceId: 'web-browser-cash-office',
          userId: manager.id,
          amount: amount,
          currency: 'NGN',
          type: 'SAFE_OPENING_BALANCE',
          reasonCode: 'SAFE_OPEN',
          notes: `Initial safe balance recorded by manager`,
          authorizerId: manager.id,
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
