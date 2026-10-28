import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { authenticateSyncRequest } from '@/lib/sync-auth';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const propertyId = searchParams.get('propertyId');

    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
    }

    const authResult = await authenticateSyncRequest(req, propertyId);
    if (!authResult.success) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    // List all unresolved conflicts for the property
    const conflicts = await prisma.syncConflict.findMany({
      where: {
        propertyId,
        status: 'PENDING'
      },
      include: {
        hotelEvent: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Score financial severity based on AggregateType and EventType
    const cloudStates = await Promise.all(conflicts.map(async (conflict) => {
      if (conflict.aggregateType === 'FOLIO') {
        const folio = await prisma.folio.findUnique({
          where: { id: conflict.aggregateId },
          select: {
            id: true,
            propertyId: true,
            reservationId: true,
            guestId: true,
            folioNumber: true,
            type: true,
            status: true,
            currency: true,
            totalCharges: true,
            totalPayments: true,
            balance: true,
            version: true,
            items: {
              select: {
                id: true,
                type: true,
                source: true,
                description: true,
                amount: true,
                currency: true,
                operationId: true,
                posTransactionId: true,
                voidedAt: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
            credits: {
              select: {
                id: true,
                amount: true,
                remainingAmount: true,
                currency: true,
                status: true,
                operationId: true,
                idempotencyKey: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
              take: 50,
            },
          },
        });
        return folio;
      }

      if (conflict.aggregateType === 'RESERVATION') {
        return prisma.reservation.findUnique({
          where: { id: conflict.aggregateId },
          select: { id: true, propertyId: true, status: true, version: true, checkIn: true, checkOut: true },
        });
      }

      if (conflict.aggregateType === 'POS_ORDER') {
        return prisma.posOrder.findUnique({
          where: { id: conflict.aggregateId },
          select: { id: true, propertyId: true, status: true, version: true, total: true, updatedAt: true },
        });
      }

      return null;
    }));

    const mapped = conflicts.map((c, index) => {
       let severity = 'LOW';
       if (c.aggregateType === 'FOLIO' || c.aggregateType === 'POS_ORDER' || c.hotelEvent.eventType.includes('CHARGE') || c.hotelEvent.eventType.includes('PAYMENT')) {
           severity = 'CRITICAL';
       } else if (c.hotelEvent.eventType === 'CHECK_IN' || c.hotelEvent.eventType === 'CHECK_OUT') {
           severity = 'HIGH';
       } else if (c.aggregateType === 'RESERVATION') {
           severity = 'MEDIUM';
       }

       return {
           id: c.id,
           propertyId: c.propertyId,
           aggregateType: c.aggregateType,
           aggregateId: c.aggregateId,
           expectedVersion: c.expectedVersion,
           receivedVersion: c.receivedVersion,
           status: c.status,
           conflictReason: c.conflictReason,
           createdAt: c.createdAt,
           cloudState: cloudStates[index],
           severity,
           edgeEvent: {
               id: c.hotelEvent.id,
               eventType: c.hotelEvent.eventType,
               payload: c.hotelEvent.payload,
               occurredAt: c.hotelEvent.occurredAt
           }
       };
    });

    return NextResponse.json(mapped);
  } catch (err: any) {
    console.error('Error fetching conflicts:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
