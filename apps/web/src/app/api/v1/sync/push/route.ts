import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const idempotencyKey = request.headers.get('Idempotency-Key');

    if (!idempotencyKey) {
      return NextResponse.json({ error: 'Idempotency-Key required' }, { status: 400 });
    }

    const {
      operationId,
      entityType,
      entityId,
      operationType,
      payloadJson,
      userId,
      deviceId,
      propertyId // The device should send its associated propertyId
    } = body;

    // 1. Validate property
    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    // 2. Idempotency Check
    // For financials, we added idempotencyKey to Payment and Refund. 
    // We should check if this operationId already exists.
    if (operationType === 'ADD_PAYMENT') {
      const existingPayment = await prisma.payment.findUnique({
        where: { idempotencyKey: operationId }
      });
      if (existingPayment) {
        return NextResponse.json({ status: 'ALREADY_APPLIED', message: 'Idempotent replay' }, { status: 200 });
      }
    }

    // Parse the payload to inspect the local business date
    const payload = JSON.parse(payloadJson);
    const desktopBusinessDate = payload.businessDate ? new Date(payload.businessDate) : null;
    
    // 3. Late Posting Check
    let isLatePosting = false;
    let latePostingReason = null;
    let originalBusinessDate = null;

    if (desktopBusinessDate && property.businessDate) {
      // Compare dates (strip time for safety)
      const cloudDate = new Date(property.businessDate).setHours(0,0,0,0);
      const edgeDate = new Date(desktopBusinessDate).setHours(0,0,0,0);

      if (edgeDate < cloudDate) {
        isLatePosting = true;
        latePostingReason = 'OFFLINE_DURING_NIGHT_AUDIT';
        originalBusinessDate = new Date(desktopBusinessDate);
      }
    }

    // 4. Process Operation
    if (entityType === 'FOLIO' && operationType === 'ADD_PAYMENT') {
      await prisma.payment.create({
        data: {
          id: entityId,
          folioId: payload.folioId,
          propertyId: propertyId,
          method: payload.method,
          amount: payload.amount,
          currency: payload.currency,
          baseAmount: payload.amount,
          status: 'COMPLETED',
          receivedBy: userId,
          idempotencyKey: operationId,
          
          // Late posting audit fields
          deviceId: deviceId,
          operationId: operationId,
          isLatePosting: isLatePosting,
          latePostingReason: latePostingReason,
          originalBusinessDate: originalBusinessDate,
          syncedAt: new Date()
        }
      });
      
      // Update Folio totals
      await prisma.folio.update({
        where: { id: payload.folioId },
        data: { totalPayments: { increment: payload.amount } }
      });
      
    } else if (entityType === 'FOLIO' && operationType === 'ADD_CHARGE') {
      await prisma.folioItem.create({
        data: {
          id: entityId,
          folioId: payload.folioId,
          businessDate: isLatePosting && property.businessDate ? property.businessDate : (desktopBusinessDate || new Date()), // Re-assign to current if late, but keep original in audit
          type: 'CHARGE',
          source: payload.source || 'MANUAL',
          description: payload.description,
          unitAmount: payload.amount,
          amount: payload.amount,
          currency: payload.currency,
          baseAmount: payload.amount,
          postedBy: userId,
          
          // Late posting audit fields
          deviceId: deviceId,
          operationId: operationId,
          isLatePosting: isLatePosting,
          latePostingReason: latePostingReason,
          originalBusinessDate: originalBusinessDate,
          syncedAt: new Date()
        }
      });
      
      await prisma.folio.update({
        where: { id: payload.folioId },
        data: { totalCharges: { increment: payload.amount } }
      });
    }

    // Return the correct cloud business date so the client can pull it
    return NextResponse.json({ 
      status: 'SYNCED',
      cloudBusinessDate: property.businessDate 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
