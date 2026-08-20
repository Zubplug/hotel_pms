import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const conflictId = (await context.params).id;
    const body = await request.json();
    const { action, userId } = body; // action: 'CITY_LEDGER', 'REJECT', 'RESOLVE_MANUAL'

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const conflict = await prisma.syncConflict.findUnique({
      where: { id: conflictId }
    });

    if (!conflict) {
      return NextResponse.json({ error: 'Conflict not found' }, { status: 404 });
    }
    
    if (conflict.status === 'RESOLVED') {
      return NextResponse.json({ status: 'ALREADY_APPLIED', message: 'Conflict already resolved' }, { status: 200 });
    }

    // Security Verification: Manager Role Check
    const userRole = await prisma.userRole.findFirst({
      where: {
        userId,
        role: { name: 'MANAGER' },
        propertyId: conflict.propertyId
      }
    });

    if (!userRole) {
      return NextResponse.json({ error: 'Unauthorized: MANAGER role required for this property' }, { status: 403 });
    }

    const payload = JSON.parse(conflict.payload as string);

    const result = await prisma.$transaction(async (tx: any) => {
      let resolutionNote = '';
      
      if (action === 'CITY_LEDGER') {
        // Idempotency Check for City Ledger Folio Item
        const existingCharge = await tx.folioItem.findFirst({
          where: { operationId: conflict.operationId }
        });

        if (existingCharge) {
          return { status: 'ALREADY_APPLIED' };
        }

        // Create a new City Ledger Folio for this specific charge
        const originalFolio = await tx.folio.findUnique({
          where: { id: conflict.entityId }
        });
        
        const cityLedgerFolio = await tx.folio.create({
          data: {
            propertyId: conflict.propertyId,
            guestId: originalFolio?.guestId,
            folioNumber: `CL-${conflict.operationId.substring(0, 8).toUpperCase()}`,
            type: 'CITY_LEDGER',
            status: 'OPEN',
            currency: originalFolio?.currency || 'NGN'
          }
        });
        
        // Post the charge to the new City Ledger Folio
        await tx.folioItem.create({
          data: {
            folioId: cityLedgerFolio.id,
            businessDate: payload.businessDate ? new Date(payload.businessDate) : new Date(),
            type: 'CHARGE',
            source: 'POS',
            description: payload.description || 'Offline POS Charge',
            unitAmount: payload.amount,
            amount: payload.amount,
            currency: payload.currency || cityLedgerFolio.currency,
            baseAmount: payload.amount,
            postedBy: userId,
            operationId: conflict.operationId,
            syncedAt: new Date()
          }
        });
        
        await tx.folio.update({
          where: { id: cityLedgerFolio.id },
          data: { totalCharges: { increment: payload.amount }, balance: { increment: payload.amount } }
        });
        
        resolutionNote = `Posted to City Ledger Folio ${cityLedgerFolio.folioNumber}`;
      } else if (action === 'REJECT') {
        resolutionNote = 'Transaction rejected and written off.';
      } else if (action === 'RESOLVE_MANUAL') {
        resolutionNote = 'Manually resolved by manager.';
      } else {
        throw new Error('Invalid resolution action');
      }

      // Mark conflict as resolved
      await tx.syncConflict.update({
        where: { id: conflictId },
        data: {
          status: 'RESOLVED',
          resolvedBy: userId,
          resolvedAt: new Date(),
          resolution: resolutionNote
        }
      });
      return { status: 'SUCCESS' };
    });

    if (result.status === 'ALREADY_APPLIED') {
      return NextResponse.json({ status: 'ALREADY_APPLIED', message: 'Idempotent replay' }, { status: 200 });
    }

    return NextResponse.json({ status: 'SUCCESS' }, { status: 200 });
  } catch (error: any) {
    console.error('Resolve conflict error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
