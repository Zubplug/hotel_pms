import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { createHash } from 'crypto';
import { compare } from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing device token' }, { status: 401 });
    }

    const deviceToken = authHeader.substring(7);
    const body = await req.json();
    const { propertyId, events } = body;

    if (!propertyId || !events || !Array.isArray(events)) {
      return NextResponse.json({ error: 'Invalid payload format' }, { status: 400 });
    }

    // Verify terminal
    const terminals = await prisma.posTerminal.findMany({
      where: { propertyId, registrationState: 'REGISTERED' }
    });

    let device = null;
    const sha256Hash = createHash('sha256').update(deviceToken).digest('hex');

    for (const t of terminals) {
      if (t.deviceCredentialHash) {
        if (t.deviceCredentialHash === sha256Hash) {
           device = t;
           break;
        }
        if (t.deviceCredentialHash.length === 60) {
           if (await compare(deviceToken, t.deviceCredentialHash)) {
             device = t;
             break;
           }
        }
      }
    }

    if (!device) {
      return NextResponse.json({ error: 'Terminal not authorized' }, { status: 403 });
    }

    const results = [];

    // Process outbox events sequentially
    for (const event of events) {
      const {
        id,
        idempotencyKey,
        aggregateType,
        aggregateId,
        aggregateVersion,
        eventType,
        occurredAt,
        sequence,
        payloadJson,
        operatorId
      } = event;
      
      try {
        const payload = JSON.parse(payloadJson || '{}');

        // 1 & 2. Atomic Concurrency Control & Execution within a Single Transaction
        await prisma.$transaction(async (tx) => {
          
          // 1. Idempotency Check (inside transaction lock)
          const existingEvent = await tx.hotelEvent.findUnique({ 
            where: { idempotencyKey },
            include: { syncConflict: true }
          });

          if (existingEvent) {
             const e = new Error('IDEMPOTENCY_DUPLICATE');
             (e as any).existingEvent = existingEvent;
             throw e;
          }

          let updatedCount = 0;
          
          if (aggregateType === 'FOLIO') {
             const res = await tx.folio.updateMany({
               where: { id: aggregateId, version: aggregateVersion },
               data: { version: { increment: 1 } }
             });
             updatedCount = res.count;
          } else if (aggregateType === 'RESERVATION') {
             const res = await tx.reservation.updateMany({
               where: { id: aggregateId, version: aggregateVersion },
               data: { version: { increment: 1 } }
             });
             updatedCount = res.count;
          }

          if (updatedCount === 0) {
             // Retrieve actual version to report in the conflict
             let currentVersion = 1;
             if (aggregateType === 'FOLIO') {
                const f = await tx.folio.findUnique({ where: { id: aggregateId }});
                if (f) currentVersion = f.version;
             } else if (aggregateType === 'RESERVATION') {
                const r = await tx.reservation.findUnique({ where: { id: aggregateId }});
                if (r) currentVersion = r.version;
             }
             
             const e = new Error('CONCURRENCY_CONFLICT');
             (e as any).currentVersion = currentVersion;
             throw e;
          }

          // Authoritative Domain Routing
          if (eventType === 'CHECK_IN') {
             await tx.reservation.update({
               where: { id: aggregateId },
               data: { status: 'CHECKED_IN' }
             });
             if (payload.roomId) {
               await tx.room.update({
                 where: { id: payload.roomId },
                 data: { status: 'OCCUPIED' }
               });
             }
          } 
          else if (eventType === 'CHECK_OUT') {
             await tx.reservation.update({
               where: { id: aggregateId },
               data: { status: 'CHECKED_OUT' }
             });
             if (payload.roomId) {
               await tx.room.update({
                 where: { id: payload.roomId },
                 data: { status: 'DIRTY' }
               });
             }
          }
          else if (eventType === 'ROOM_CHARGE' || eventType === 'POST_CHARGE') {
             const amount = Number(payload.amount);
             await tx.folioItem.create({
               data: {
                 folioId: aggregateId,
                 businessDate: new Date(payload.businessDate || new Date()),
                 type: 'CHARGE',
                 source: payload.source || 'ROOM_CHARGE',
                 description: payload.description,
                 quantity: 1,
                 unitAmount: amount,
                 amount: amount,
                 currency: payload.currency || 'NGN',
                 baseAmount: amount,
                 postedBy: operatorId || device.id, // Fallback
                 deviceId: device.id,
                 isLatePosting: true,
                 posTransactionId: idempotencyKey
               }
             });

             await tx.folio.update({
               where: { id: aggregateId },
               data: { totalCharges: { increment: amount }, balance: { increment: amount } }
             });
          }
          else {
            throw new Error(`Unknown eventType: ${eventType}`);
          }

          // 3. Save Immutable HotelEvent (Subject to unique constraint on aggregateVersion)
          await tx.hotelEvent.create({
            data: {
              id,
              idempotencyKey,
              propertyId,
              deviceId: device.id,
              operatorId,
              aggregateType,
              aggregateId,
              aggregateVersion,
              eventType,
              occurredAt: new Date(occurredAt || Date.now()),
              sequence,
              payload
            }
          });
        });
        
        results.push({ id, status: 'SYNCED', idempotencyKey });
        
      } catch (err: any) {
        if (err.message === 'IDEMPOTENCY_DUPLICATE') {
           if (err.existingEvent.syncConflict) {
             results.push({ id, status: 'CONFLICT', idempotencyKey, error: 'Already flagged as conflict.' });
           } else {
             results.push({ id, status: 'SYNCED', idempotencyKey });
           }
        } else if (err.message === 'CONCURRENCY_CONFLICT' || err.code === 'P2002') {
           // If P2002, it means another thread inserted the same aggregateVersion for this aggregate.
           let expectedVersion = err.currentVersion || aggregateVersion;
           
           if (err.code === 'P2002') {
               // Fetch the true actual version from DB to populate the conflict correctly
               try {
                   if (aggregateType === 'FOLIO') {
                       const f = await prisma.folio.findUnique({ where: { id: aggregateId }});
                       if (f) expectedVersion = f.version;
                   } else if (aggregateType === 'RESERVATION') {
                       const r = await prisma.reservation.findUnique({ where: { id: aggregateId }});
                       if (r) expectedVersion = r.version;
                   }
               } catch (e) {}
           }
           // We must record the HotelEvent and SyncConflict outside the failed business transaction
           try {
             await prisma.$transaction(async (tx2) => {
                const ev = await tx2.hotelEvent.create({
                  data: {
                    id,
                    idempotencyKey,
                    propertyId,
                    deviceId: device.id,
                    operatorId,
                    aggregateType,
                    aggregateId,
                    aggregateVersion,
                    eventType,
                    occurredAt: new Date(occurredAt || Date.now()),
                    sequence,
                    payload: JSON.parse(payloadJson || '{}')
                  }
                });
                
                await tx2.syncConflict.create({
                  data: {
                    propertyId,
                    hotelEventId: ev.id,
                    aggregateType,
                    aggregateId,
                    expectedVersion: expectedVersion,
                    receivedVersion: aggregateVersion,
                    conflictReason: 'Optimistic Concurrency Failure: Edge node operated on stale state.',
                    status: 'PENDING'
                  }
                });
             });
             results.push({ id, status: 'CONFLICT', idempotencyKey, error: 'Concurrency conflict. Manager resolution required.' });
           } catch (conflictErr: any) {
             console.error(`Error saving conflict for event ${id}:`, conflictErr);
             results.push({ id, status: 'FAILED', idempotencyKey, error: 'Failed to record conflict state.' });
           }
        } else {
           console.error(`Error processing event ${id}:`, err);
           results.push({ id, status: 'FAILED', idempotencyKey, error: err.message });
        }
      }
    }

    return NextResponse.json({ 
      status: 'SUCCESS',
      results
    }, { status: 200 });

  } catch (error: any) {
    console.error('FrontDesk Sync Push Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
