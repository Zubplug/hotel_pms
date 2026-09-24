import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import crypto from 'crypto';
import { isNightAuditCutoverActive } from '@/lib/night-audit-guard';
import { GLMappingService } from '@/lib/services/gl-mapping-service';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';
import type { PaymentMethod } from '@hotel-pms/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !session.user?.id) {
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
    if (await isNightAuditCutoverActive(conflict.propertyId)) {
       return NextResponse.json({ error: 'Night audit is processing. Financial sync conflicts can be resolved after audit posting completes.', code: 'NIGHT_AUDIT_IN_PROGRESS' }, { status: 409 });
    }

    const edgeEvent = conflict.hotelEvent;
    
    // Evaluate Financial Severity
    let isFinancial = false;
    if (conflict.aggregateType === 'FOLIO' || conflict.aggregateType === 'POS_ORDER' || edgeEvent.eventType.includes('CHARGE') || edgeEvent.eventType.includes('PAYMENT')) {
       isFinancial = true;
    }

    const { requireOrganizationContext } = await import('@/lib/organization-access');
    const ctx = await requireOrganizationContext(session.user.id);
    if (!ctx.propertyIds.includes(conflict.propertyId)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const userRole = ctx.role;
    const isNightAuditor = userRole === 'NIGHT_AUDITOR';
    
    if (userRole !== 'MANAGER' && userRole !== 'ADMIN' && userRole !== 'OWNER' && userRole !== 'SUPER_ADMIN' && userRole !== 'CEO' && userRole !== 'FINANCE_MANAGER' && !isNightAuditor) {
        return NextResponse.json({ error: 'Insufficient permissions. Requires RESOLVE_SYNC_CONFLICT.' }, { status: 403 });
    }
    if (isFinancial && userRole !== 'ADMIN' && userRole !== 'OWNER' && userRole !== 'SUPER_ADMIN' && userRole !== 'CEO' && userRole !== 'FINANCE_MANAGER' && !isNightAuditor) {
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
                let roomIdToOccupy = payload.roomId;
                if (!roomIdToOccupy) {
                   const activeResRoom = await tx.reservationRoom.findFirst({ where: { reservationId: r.id, status: "ACTIVE" } });
                   if (activeResRoom && activeResRoom.roomId) {
                     roomIdToOccupy = activeResRoom.roomId;
                   }
                }
                if (roomIdToOccupy) {
                   await tx.room.update({ where: { id: roomIdToOccupy }, data: { status: "OCCUPIED" } });
                }
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
             } else if (edgeEvent.eventType === 'CHECKIN_BYPASS') {
                 const bypassOpId = payload.operationId || edgeEvent.id;
                 const existingBypass = await tx.checkInBypass.findUnique({
                   where: { operationId: bypassOpId },
                 });
                 if (!existingBypass) {
                   if (!edgeEvent.operatorId) throw new Error("Operator ID missing from edge event");
                   
                   const staff = await tx.staff.findFirst({
                     where: {
                       OR: [
                         { id: edgeEvent.operatorId },
                         { userId: edgeEvent.operatorId }
                       ]
                     }
                   });
                   if (!staff) throw new Error("Staff record not found for operator");

                   const operatorSession = await tx.frontdeskSession.findFirst({
                     where: { propertyId: conflict.propertyId, staffId: staff.id, controlStatus: 'OPEN' }
                   });

                   if (!operatorSession) {
                     throw new Error("No open FrontdeskSession found for operator to bypass checkin.");
                   }

                   await tx.checkInBypass.create({
                     data: {
                       propertyId: conflict.propertyId,
                       reservationId: r.id,
                       acknowledgedByStaffId: payload.acknowledgedByStaffId,
                       reason: payload.reason,
                       operationId: bypassOpId,
                       frontdeskSessionId: operatorSession.id,
                       operatorId: staff.id,
                       businessDate: operatorSession.businessDate,
                       status: 'PENDING',
                       createdAt: new Date(),
                     },
                   });
                 }
                 await tx.reservation.update({ where: { id: r.id }, data: { version: { increment: 1 } } });
             } else {
                 await tx.reservation.update({ where: { id: r.id }, data: { version: { increment: 1 } } });
             }
          }
          else if (conflict.aggregateType === 'CITY_LEDGER') {
             if (edgeEvent.eventType === 'CITY_LEDGER_PAYMENT') {
               const amount = Number(payload.amount);
               const accountId = String(payload.accountId || '');
               const invoiceId: string | null = payload.invoiceId || null;
               const accountType = String(payload.accountType || '').toUpperCase();
               const frontdeskSessionId = String(payload.frontdeskSessionId || '');
               const method = String(payload.method || 'BANK_TRANSFER').toUpperCase();
               const reference = String(payload.reference || '').trim();
               const isUuid = (v: unknown): v is string =>
                 typeof v === 'string' &&
                 /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);

               if (!Number.isFinite(amount) || amount <= 0 || !isUuid(accountId) || !isUuid(frontdeskSessionId) || !reference)
                 throw new Error('DOMAIN_ERROR: City ledger payment requires account, shift, amount, and reference');
               if (!['CASH', 'BANK_TRANSFER', 'POS', 'CARD', 'CHEQUE', 'OTHER'].includes(method))
                 throw new Error('DOMAIN_ERROR: Invalid city ledger payment method');

               const account = await tx.cityLedgerAccount.findUnique({ where: { id: accountId } });
               if (!account || account.propertyId !== conflict.propertyId || !['CORPORATE', 'SKIPPER'].includes(account.type) || (accountType && account.type !== accountType))
                 throw new Error('DOMAIN_ERROR: CITY_LEDGER_ACCOUNT_NOT_AVAILABLE');

               const frontdeskSession = await tx.frontdeskSession.findUnique({ where: { id: frontdeskSessionId }, select: { propertyId: true, staffId: true, businessDate: true } });
               if (!frontdeskSession || frontdeskSession.propertyId !== conflict.propertyId)
                 throw new Error('DOMAIN_ERROR: FRONTDESK_SHIFT_NOT_FOUND');

               if (account.type !== 'CORPORATE' && !invoiceId)
                 throw new Error('DOMAIN_ERROR: WALKOUT_INVOICE_REQUIRED');
               if (invoiceId && !isUuid(invoiceId))
                 throw new Error('DOMAIN_ERROR: INVALID_INVOICE');

               const invoice = invoiceId ? await tx.cityLedgerInvoice.findUnique({ where: { id: invoiceId } }) : null;
               if (invoiceId && (!invoice || invoice.accountId !== accountId || invoice.status === 'PAID' || invoice.status === 'VOID'))
                 throw new Error('DOMAIN_ERROR: CITY_LEDGER_INVOICE_NOT_AVAILABLE');
               if (invoice && amount > Number(invoice.outstandingAmount) + 0.01)
                 throw new Error('DOMAIN_ERROR: PAYMENT_EXCEEDS_INVOICE_BALANCE');

               // Idempotency guard — if a payment entry with this reference already exists, skip silently.
               const existingPayment = await tx.cityLedgerEntry.findFirst({ where: { reference, accountId, type: 'PAYMENT' } });
               if (!existingPayment) {
                 const invoices = invoice
                   ? [invoice]
                   : await tx.cityLedgerInvoice.findMany({ where: { accountId, status: { in: ['OPEN', 'PARTIALLY_PAID'] } }, orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }] });

                 if (!invoice && account.type !== 'CORPORATE')
                   throw new Error('DOMAIN_ERROR: WALKOUT_INVOICE_REQUIRED');

                 let masterFolio = await tx.folio.findFirst({ where: { propertyId: conflict.propertyId, type: 'CITY_LEDGER', corporateAccountId: null, reservationId: null, status: 'OPEN' } });
                 if (!masterFolio)
                   masterFolio = await tx.folio.create({ data: { propertyId: conflict.propertyId, type: 'CITY_LEDGER', status: 'OPEN', currency: account.currency, folioNumber: `AR-${conflict.propertyId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}` } });

                 const payment = await tx.payment.create({
                   data: {
                     folioId: masterFolio.id,
                     propertyId: conflict.propertyId,
                     frontdeskSessionId,
                     method: method as PaymentMethod,
                     collectionSource: 'RECEIVABLES',
                     amount,
                     currency: account.currency,
                     baseAmount: amount,
                     status: 'COMPLETED',
                     businessDate: frontdeskSession.businessDate,
                     idempotencyKey: edgeEvent.idempotencyKey,
                     reference,
                     receivedBy: frontdeskSession.staffId,
                     notes: invoice ? `City ledger settlement for ${invoice.invoiceNumber || invoiceId}` : 'Front Desk corporate city ledger payment (conflict force)',
                   }
                 });
                 await tx.folio.update({ where: { id: masterFolio.id }, data: { totalPayments: { increment: amount }, balance: { decrement: amount } } });

                 let remaining = amount;
                 let appliedAmount = 0;
                 for (const openInvoice of invoices) {
                   if (remaining <= 0.01) break;
                   const applied = Math.min(remaining, Number(openInvoice.outstandingAmount));
                   const invoiceRemaining = Number(openInvoice.outstandingAmount) - applied;
                   await tx.cityLedgerInvoice.update({ where: { id: openInvoice.id }, data: { paidAmount: { increment: applied }, outstandingAmount: invoiceRemaining, status: invoiceRemaining <= 0.01 ? 'PAID' : 'PARTIALLY_PAID' } });
                   remaining -= applied;
                   appliedAmount += applied;
                 }

                 const paymentEntry = await tx.cityLedgerEntry.create({
                   data: {
                     accountId,
                     propertyId: conflict.propertyId,
                     amount,
                     currency: account.currency,
                     type: 'PAYMENT',
                     status: remaining <= 0.01 ? 'SETTLED' : 'OPEN',
                     reference,
                     reason: invoice ? `Settlement for invoice ${invoice.invoiceNumber || invoiceId}` : appliedAmount > 0.01 ? 'Bulk corporate city ledger payment (conflict force)' : 'Unapplied corporate advance (conflict force)',
                     createdBy: session.user?.id || 'SYSTEM',
                   }
                 });

                 let allocationRemaining = amount;
                 for (const openInvoice of invoices) {
                   if (allocationRemaining <= 0.01) break;
                   const applied = Math.min(allocationRemaining, Number(openInvoice.outstandingAmount));
                   await tx.cityLedgerAllocation.create({ data: { paymentId: paymentEntry.id, invoiceId: openInvoice.id, amount: applied, currency: openInvoice.currency, createdBy: session.user?.id || 'SYSTEM' } });
                   if (Number(openInvoice.outstandingAmount) - applied <= 0.01)
                     await tx.cityLedgerEntry.updateMany({ where: { invoiceId: openInvoice.id, type: 'TRANSFER_IN', status: 'OPEN' }, data: { status: 'SETTLED' } });
                   allocationRemaining -= applied;
                 }

                 if (appliedAmount > 0.01)
                   await tx.cityLedgerAccount.update({ where: { id: accountId }, data: { balance: { decrement: appliedAmount } } });

                 const propertyRecord = await tx.property.findUnique({ where: { id: conflict.propertyId }, select: { organizationId: true, businessDate: true } });
                 const businessDate = propertyRecord?.businessDate || frontdeskSession.businessDate;
                 const glLines: { accountId: string; debit: number; credit: number; description: string; sourceType: string; sourceId: string }[] = [
                   { accountId: await GLMappingService.getAssetAccountForMethod(conflict.propertyId, method), debit: amount, credit: 0, description: `Receivable collection by ${method}`, sourceType: 'CITY_LEDGER_PAYMENT', sourceId: payment.id },
                   ...(appliedAmount > 0.01 ? [{ accountId: await GLMappingService.getCityLedgerAccount(conflict.propertyId), debit: 0, credit: appliedAmount, description: 'Reduce city ledger receivable', sourceType: 'CITY_LEDGER_PAYMENT', sourceId: payment.id }] : []),
                 ];
                 if (remaining > 0.01 && account.type === 'CORPORATE')
                   glLines.push({ accountId: await GLMappingService.getCorporateAdvancesAccount(conflict.propertyId), debit: 0, credit: remaining, description: 'Unapplied corporate advance', sourceType: 'CITY_LEDGER_PAYMENT', sourceId: payment.id });

                 await GeneralLedgerService.postJournal(
                   { userId: session.user?.id || 'SYSTEM', propertyIds: [conflict.propertyId], organizationId: propertyRecord?.organizationId || '', role: 'SYSTEM', permissions: [], outletIds: [] },
                   { propertyId: conflict.propertyId, entryDate: businessDate, reference: `CITY-LEDGER-PAYMENT-${edgeEvent.idempotencyKey}`, description: invoice ? `Settle city ledger invoice ${invoice.invoiceNumber || invoiceId}` : 'Corporate city ledger payment (conflict force)', sourceModule: 'AR', lines: glLines },
                   tx,
                 );
               }
               currentVersion = 1; // CITY_LEDGER entries are not versioned
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
                       businessDate: new Date(payload.businessDate || new Date()),
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
