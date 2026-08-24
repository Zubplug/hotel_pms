import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { action, resolutionComment } = body;

    if (!['FORCE_EDGE_EVENT', 'REJECT_EDGE_EVENT', 'MANUAL_CORRECTION'].includes(action)) {
       return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const conflict = await prisma.syncConflict.findUnique({
      where: { id },
      include: { hotelEvent: true }
    });

    if (!conflict) return NextResponse.json({ error: 'Conflict not found' }, { status: 404 });
    if (conflict.status !== 'PENDING') return NextResponse.json({ error: 'Conflict already resolved' }, { status: 400 });

    const edgeEvent = conflict.hotelEvent;
    
    // Evaluate Financial Severity
    let isFinancial = false;
    if (conflict.aggregateType === 'FOLIO' || conflict.aggregateType === 'POS_ORDER' || edgeEvent.eventType.includes('CHARGE') || edgeEvent.eventType.includes('PAYMENT')) {
       isFinancial = true;
    }

    // Role verification (simplified mapping: we check if user is manager, in reality we'd query RolePermission)
    // For this implementation, we require 'MANAGER' or 'ADMIN' role on the session.
    // If it's financial, we require 'ADMIN' or explicit FORCE_SYNC_RESOLUTION.
    const userRole = (session.user as any).role || 'STAFF';
    if (userRole !== 'MANAGER' && userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return NextResponse.json({ error: 'Insufficient permissions. Requires RESOLVE_SYNC_CONFLICT.' }, { status: 403 });
    }
    if (isFinancial && userRole !== 'ADMIN' && userRole !== 'OWNER') {
        return NextResponse.json({ error: 'Financial conflicts require FORCE_SYNC_RESOLUTION capability.' }, { status: 403 });
    }

    await prisma.$transaction(async (tx) => {
       // Re-read conflict with lock
       const currentConflict = await tx.syncConflict.findUnique({ where: { id } });
       if (currentConflict?.status !== 'PENDING') throw new Error('ALREADY_RESOLVED');

       // Execute Action
       if (action === 'REJECT_EDGE_EVENT') {
          // Do nothing to the aggregate. Just mark as resolved.
          await tx.syncConflict.update({
            where: { id },
            data: { 
              status: 'RESOLVED', 
              resolution: 'REJECTED', 
              resolvedBy: session.user?.id || 'SYSTEM', 
              resolvedAt: new Date() 
            }
          });
          return;
       }

       if (action === 'MANUAL_CORRECTION') {
          if (!resolutionComment?.trim()) throw new Error('MANUAL_CORRECTION requires a resolution comment');
          await tx.syncConflict.update({
            where: { id },
            data: {
              status: 'RESOLVED',
              resolution: `MANUAL_CORRECTION: ${resolutionComment.trim()}`,
              resolvedBy: session.user?.id || 'SYSTEM',
              resolvedAt: new Date()
            }
          });
          return;
       }

       if (action === 'FORCE_EDGE_EVENT') {
          let updatedCount = 0;
          let currentVersion = 1;
          const payload = edgeEvent.payload as any;

          if (conflict.aggregateType === 'RESERVATION') {
             const r = await tx.reservation.findUnique({ where: { id: conflict.aggregateId } });
             if (!r) throw new Error('Aggregate not found');
             currentVersion = r.version;

             // Domain validation for Reservations
             if (edgeEvent.eventType === 'CHECK_IN') {
                if (r.status === 'CHECKED_OUT') throw new Error('DOMAIN_ERROR: Cannot check in a CHECKED_OUT reservation.');
                await tx.reservation.update({ where: { id: r.id }, data: { status: 'CHECKED_IN', version: { increment: 1 } } });
             } else if (edgeEvent.eventType === 'CHECK_OUT') {
                await tx.reservation.update({ where: { id: r.id }, data: { status: 'CHECKED_OUT', version: { increment: 1 } } });
             } else if (edgeEvent.eventType === 'KEYCARD_ENCODE') {
                const roomId = payload.roomId || undefined;
                if (!roomId) throw new Error('DOMAIN_ERROR: Keycard event has no room assignment.');
                let doorLock = await tx.doorLock.findFirst({ where: { roomId } });
                if (!doorLock) {
                  doorLock = await tx.doorLock.create({
                    data: {
                      propertyId: conflict.propertyId,
                      roomId,
                      lockCode: `ENCODER-${roomId}`,
                      provider: 'DELUNS_ENCODER',
                      status: 'ONLINE'
                    }
                  });
                }
                const encodeData = payload.encodeData || {};
                const credential = await tx.lockCredential.create({
                  data: {
                    reservationId: r.id,
                    roomId,
                    lockId: doorLock.id,
                    credentialType: 'rfid',
                    status: 'ACTIVE',
                    validFrom: new Date(),
                    validUntil: new Date(r.checkOut),
                    cardSerialNumber: encodeData.cardSnr || null,
                    metadata: encodeData
                  }
                });
                await tx.lockOperation.create({
                  data: {
                    propertyId: conflict.propertyId,
                    reservationId: r.id,
                    roomId,
                    lockId: doorLock.id,
                    credentialId: credential.id,
                    idempotencyKey: `RESOLVE_KEYCARD:${conflict.id}`,
                    operation: 'ENCODE_CARD',
                    status: 'COMPLETED',
                    requestedAt: new Date(),
                    startedAt: new Date(),
                    completedAt: new Date(),
                    metadata: { initiatedBy: session.user?.id || 'SYSTEM', responseData: encodeData }
                  }
                });
                await tx.reservation.update({ where: { id: r.id }, data: { version: { increment: 1 } } });
             } else {
                 await tx.reservation.update({ where: { id: r.id }, data: { version: { increment: 1 } } });
             }
          } 
          else if (conflict.aggregateType === 'FOLIO') {
             const f = await tx.folio.findUnique({ where: { id: conflict.aggregateId } });
             if (!f) throw new Error('Aggregate not found');
             currentVersion = f.version;

             // Domain validation for Folios
             if (edgeEvent.eventType === 'ROOM_CHARGE' || edgeEvent.eventType === 'POST_CHARGE') {
                 const amount = Number(payload.amount);
                 await tx.folioItem.create({
                   data: {
                     folioId: f.id,
                     businessDate: new Date(payload.businessDate || new Date()),
                     type: 'CHARGE',
                     source: payload.source || 'ROOM_CHARGE',
                     description: payload.description,
                     quantity: 1,
                     unitAmount: amount,
                     amount: amount,
                     currency: payload.currency || 'NGN',
                     baseAmount: amount,
                     postedBy: edgeEvent.operatorId || 'SYSTEM',
                     deviceId: edgeEvent.deviceId,
                     posTransactionId: edgeEvent.idempotencyKey
                   }
                 });
                 await tx.folio.update({
                   where: { id: f.id },
                   data: { totalCharges: { increment: amount }, balance: { increment: amount }, version: { increment: 1 } }
                 });
             } else if (edgeEvent.eventType === 'POST_PAYMENT') {
                 const amount = Number(payload.amount);
                 if (!Number.isFinite(amount) || amount <= 0) throw new Error('DOMAIN_ERROR: Payment amount must be positive.');

                 const paymentIdempotencyKey = `pay_${edgeEvent.idempotencyKey}`;
                 const existingPayment = await tx.payment.findUnique({ where: { idempotencyKey: paymentIdempotencyKey } });
                 if (!existingPayment) {
                   const existingItem = await tx.folioItem.findFirst({ where: { posTransactionId: edgeEvent.idempotencyKey } });
                   if (!existingItem) {
                     await tx.folioItem.create({
                       data: {
                         folioId: f.id,
                         businessDate: new Date(payload.businessDate || new Date()),
                         type: 'PAYMENT',
                         source: 'MANUAL',
                         description: payload.description || `${payload.method || 'PAYMENT'} payment`,
                         quantity: 1,
                         unitAmount: -amount,
                         amount: -amount,
                         currency: payload.currency || f.currency,
                         baseAmount: amount,
                         postedBy: edgeEvent.operatorId || 'SYSTEM',
                         deviceId: edgeEvent.deviceId,
                         isLatePosting: true,
                         posTransactionId: edgeEvent.idempotencyKey
                       }
                     });
                   }

                   await tx.payment.create({
                     data: {
                       folioId: f.id,
                       propertyId: conflict.propertyId,
                       reservationId: f.reservationId,
                       method: (['CASH', 'BANK_TRANSFER', 'POS', 'CARD', 'CARD_OFFLINE', 'PAYMENT_GATEWAY', 'MOBILE_PAYMENT', 'CHEQUE', 'ROOM_CHARGE', 'OTHER'].includes(String(payload.method || '').toUpperCase())
                         ? String(payload.method || 'OTHER').toUpperCase()
                         : 'OTHER') as any,
                       amount,
                       currency: payload.currency || f.currency,
                       baseAmount: amount,
                       status: 'COMPLETED',
                       idempotencyKey: paymentIdempotencyKey,
                       receivedBy: edgeEvent.operatorId || 'SYSTEM',
                       deviceId: edgeEvent.deviceId
                     }
                   });

                   await tx.folio.update({
                     where: { id: f.id },
                     data: { totalPayments: { increment: amount }, balance: { decrement: amount }, version: { increment: 1 } }
                   });
                 }
             } else {
                 await tx.folio.update({ where: { id: f.id }, data: { version: { increment: 1 } } });
             }
          }

          // Generate Compensating Resolution Event
          const newVersion = currentVersion + 1;
          await tx.hotelEvent.create({
              data: {
                  id: crypto.randomUUID(),
                  idempotencyKey: `RES-${conflict.id}`,
                  propertyId: conflict.propertyId,
                  deviceId: 'SYNC_CENTER',
                  operatorId: session.user?.id || 'SYSTEM',
                  aggregateType: conflict.aggregateType,
                  aggregateId: conflict.aggregateId,
                  aggregateVersion: newVersion,
                  eventType: 'CONFLICT_RESOLUTION',
                  occurredAt: new Date(),
                  sequence: edgeEvent.sequence,
                  payload: {
                      originalEventId: edgeEvent.id,
                      resolutionType: action,
                      reason: resolutionComment,
                      previousCloudVersion: currentVersion,
                      newCloudVersion: newVersion
                  }
              }
          });

          await tx.syncConflict.update({
            where: { id },
            data: { 
              status: 'RESOLVED', 
              resolution: 'FORCED', 
              resolvedBy: session.user?.id || 'SYSTEM', 
              resolvedAt: new Date() 
            }
          });
       }
    });

    return NextResponse.json({ status: 'SUCCESS' });
  } catch (err: any) {
    console.error('Error resolving conflict:', err);
    if (err.message.startsWith('DOMAIN_ERROR')) {
       return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
