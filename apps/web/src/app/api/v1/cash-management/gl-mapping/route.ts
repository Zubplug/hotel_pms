import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const userId = session?.user?.id;
    const propertyId = session?.user?.propertyId;

    if (!userId || !propertyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { cashAccountId, glAccountId } = body;

    if (!cashAccountId || !glAccountId) {
      return NextResponse.json({ error: 'Missing cashAccountId or glAccountId' }, { status: 400 });
    }

    // 1. Fetch both records to validate
    const cashAccount = await prisma.cashAccount.findUnique({
      where: { id: cashAccountId },
      include: { property: true }
    });

    const glAccount = await prisma.chartOfAccount.findUnique({
      where: { id: glAccountId }
    });

    if (!cashAccount) {
      return NextResponse.json({ error: 'Cash Account not found' }, { status: 404 });
    }

    if (!glAccount) {
      return NextResponse.json({ error: 'GL Account not found' }, { status: 404 });
    }

    // 2. Enforce: CashAccount and GL account belong to the same property/organization.
    if (cashAccount.propertyId !== propertyId || glAccount.propertyId !== propertyId) {
      return NextResponse.json({ error: 'Cross-property mapping is forbidden' }, { status: 403 });
    }

    // 3. Enforce: Only appropriate asset/cash GL accounts can be selected.
    // Prevent accidental mapping of revenue, expense, liability, etc.
    if (glAccount.type !== 'ASSET') {
      return NextResponse.json({ error: 'Only ASSET accounts can be mapped to Cash Accounts.' }, { status: 400 });
    }

    const previousGlAccountId = cashAccount.glAccountId;
    const organizationId = cashAccount.property.organizationId;

    // 4. Perform the update & log it atomically
    await prisma.$transaction(async (tx) => {
      await tx.cashAccount.update({
        where: { id: cashAccountId },
        data: { glAccountId }
      });

      // Simple audit logging record (assumes an OutboxEvent or similar for audit, depending on existing systems)
      // Here we create a generic outbox event to record who changed the mapping and when.
      await tx.outboxEvent.create({
        data: {
          propertyId,
          organizationId, 
          eventType: 'CASH_ACCOUNT_MAPPING_CHANGED',
          aggregateType: 'CashAccount',
          aggregateId: cashAccountId,
          payload: {
            cashAccountId,
            oldGlAccountId: previousGlAccountId,
            newGlAccountId: glAccountId,
            changedByUserId: userId,
            changedAt: new Date().toISOString()
          }
        }
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating GL mapping:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
