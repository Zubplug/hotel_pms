import { NextRequest, NextResponse } from "next/server";
import prisma from "@hotel-pms/db";
import { randomUUID } from "crypto";

// Handle POS Sync Push supporting both Legacy SyncEvents and new HotelEvents
export async function POST(req: NextRequest) {
  const requestId = randomUUID();
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn(`[sync/pos-push] request=${requestId} rejected missing bearer token`);
      return NextResponse.json({ error: "Missing or invalid authorization" }, { status: 401 });
    }
    const token = authHeader.substring(7);
    const body = await req.json();
    console.info(`[sync/pos-push] request=${requestId} received propertyId=${body.propertyId ?? "missing"} events=${Array.isArray(body.events) ? body.events.length : "invalid"}`);

    if (!body.events || !Array.isArray(body.events)) {
      console.warn(`[sync/pos-push] request=${requestId} rejected invalid events array`);
      return NextResponse.json({ error: "Invalid payload format" }, { status: 400 });
    }

    if (body.events.length === 0) {
      return NextResponse.json({ accepted: [], alreadyProcessed: [], rejected: [], conflicts: [], serverCursor: "seq_0", results: [] });
    }

    // Determine Property ID from terminal or payload. For simplicity, assume all events are from same terminal.
    // In legacy, terminalId is on the event. In new, deviceId is on the event.
    const firstEvent = body.events[0];
    const terminalId = firstEvent.terminalId || firstEvent.deviceId;
    
    if (!terminalId) {
       console.warn(`[sync/pos-push] request=${requestId} rejected missing terminal identity firstEvent=${firstEvent.operationId ?? firstEvent.id ?? "unknown"}`);
       return NextResponse.json({ error: "Missing terminal identity" }, { status: 400 });
    }

    const terminal = await prisma.posTerminal.findUnique({
      where: { id: terminalId },
      include: { outlet: { include: { property: true } } }
    });

    if (!terminal || terminal.registrationState !== 'REGISTERED') {
      console.warn(`[sync/pos-push] request=${requestId} rejected terminalId=${terminalId} found=${!!terminal} state=${terminal?.registrationState ?? "missing"}`);
      return NextResponse.json({ error: "Terminal inactive or unauthorized" }, { status: 403 });
    }
    
    const propertyId = terminal.outlet?.propertyId;
    if (!propertyId) {
      console.warn(`[sync/pos-push] request=${requestId} rejected terminalId=${terminalId} has no property`);
      return NextResponse.json({ error: "Terminal not associated with a property" }, { status: 400 });
    }

    console.info(`[sync/pos-push] request=${requestId} authorized terminalId=${terminal.id} propertyId=${propertyId} events=${body.events.length}`);

    const results: any[] = [];
    const accepted: string[] = [];
    const alreadyProcessed: string[] = [];
    const rejected: string[] = [];
    const conflicts: string[] = [];
    let lastSequenceNumber = 0;

    for (const rawEvent of body.events) {
      const isLegacy = !!rawEvent.operationId;
      
      // Compatibility Layer: Map Legacy SyncEvent to HotelEvent envelope
      const event = isLegacy ? {
        id: rawEvent.operationId,
        idempotencyKey: rawEvent.operationId,
        propertyId: propertyId,
        deviceId: rawEvent.terminalId,
        operatorId: rawEvent.operatorId,
        aggregateType: rawEvent.entityType,
        aggregateId: rawEvent.entityId,
        aggregateVersion: 1, // Legacy events don't have version tracking; assume 1 or fetch from DB
        eventType: rawEvent.operationType,
        occurredAt: rawEvent.createdAt,
        sequence: rawEvent.sequenceNumber,
        payloadJson: rawEvent.payloadJson
      } : {
        id: rawEvent.id,
        idempotencyKey: rawEvent.idempotencyKey,
        propertyId: rawEvent.propertyId || propertyId,
        deviceId: rawEvent.deviceId,
        operatorId: rawEvent.operatorId,
        aggregateType: rawEvent.aggregateType,
        aggregateId: rawEvent.aggregateId,
        aggregateVersion: rawEvent.aggregateVersion,
        eventType: rawEvent.eventType,
        occurredAt: rawEvent.occurredAt,
        sequence: rawEvent.sequence,
        payloadJson: typeof rawEvent.payload === 'string' ? rawEvent.payload : JSON.stringify(rawEvent.payload || {})
      };

      try {
        const payload = typeof event.payloadJson === 'string' ? JSON.parse(event.payloadJson || '{}') : event.payloadJson;
        
        await prisma.$transaction(async (tx: any) => {
          // 1. Idempotency Check
          const existingEvent = await tx.hotelEvent.findUnique({ 
            where: { idempotencyKey: event.idempotencyKey },
            include: { syncConflict: true }
          });

          if (existingEvent) {
             const e = new Error('IDEMPOTENCY_DUPLICATE');
             (e as any).existingEvent = existingEvent;
             throw e;
          }
          
          let updatedCount = 0;
          
          // 2. Lock & Verify OCC Version
          if (event.aggregateType === 'POS_ORDER') {
             const res = await tx.posOrder.updateMany({
               where: { id: event.aggregateId, version: event.aggregateVersion },
               data: { version: { increment: 1 } }
             });
             updatedCount = res.count;
          } else if (event.aggregateType === 'POS_SESSION' || event.aggregateType === 'POS_OPERATOR_SESSION') {
             const res = await tx.posOperatorSession.updateMany({
               where: { id: event.aggregateId, version: event.aggregateVersion },
               data: { version: { increment: 1 } }
             });
             updatedCount = res.count;
          } else if (event.aggregateType === 'POS_CHECK') {
             const res = await tx.posCheck.updateMany({
               where: { id: event.aggregateId, version: event.aggregateVersion },
               data: { version: { increment: 1 } }
             });
             updatedCount = res.count;
          } else if (event.aggregateType === 'POS_SETTLEMENT' || event.aggregateType === 'POS_CASH_MOVEMENT' || event.aggregateType === 'CASH_MOVEMENT') {
             const sId = payload.SessionId || payload.sessionId || payload.PosSessionId || payload.posSessionId;
             if (sId) {
                const res = await tx.posOperatorSession.updateMany({
                  where: { id: sId, version: event.aggregateVersion },
                  data: { version: { increment: 1 } }
                });
                updatedCount = res.count;
             } else {
                updatedCount = 1;
             }
          } else {
             // For POS_PAYMENT, POS_ORDER_ITEM, POS_KOT the aggregate is usually the PosOrder. 
             // We map those to update the Order version.
             if (payload.OrderId || payload.orderId) {
                const oId = payload.OrderId || payload.orderId;
                const res = await tx.posOrder.updateMany({
                  where: { id: oId, version: event.aggregateVersion },
                  data: { version: { increment: 1 } }
                });
                updatedCount = res.count;
             } else {
                // No OCC for this specific non-aggregate entity (e.g. unknown payload)
                updatedCount = 1; 
             }
          }

          if (updatedCount === 0) {
             let currentVersion = 1;
             if (event.aggregateType === 'POS_ORDER') {
                const o = await tx.posOrder.findUnique({ where: { id: event.aggregateId }});
                if (o) currentVersion = o.version;
             } else if (event.aggregateType === 'POS_SESSION' || event.aggregateType === 'POS_OPERATOR_SESSION') {
                const s = await tx.posOperatorSession.findUnique({ where: { id: event.aggregateId }});
                if (s) currentVersion = s.version;
             } else if (event.aggregateType === 'POS_CHECK') {
                const c = await tx.posCheck.findUnique({ where: { id: event.aggregateId }});
                if (c) currentVersion = c.version;
             } else if (event.aggregateType === 'POS_SETTLEMENT' || event.aggregateType === 'POS_CASH_MOVEMENT' || event.aggregateType === 'CASH_MOVEMENT') {
                const sId = payload.SessionId || payload.sessionId || payload.PosSessionId || payload.posSessionId;
                if (sId) {
                   const s = await tx.posOperatorSession.findUnique({ where: { id: sId }});
                   if (s) currentVersion = s.version;
                }
             } else if (payload.OrderId || payload.orderId) {
                const o = await tx.posOrder.findUnique({ where: { id: (payload.OrderId || payload.orderId) }});
                if (o) currentVersion = o.version;
             }
             const e = new Error('CONCURRENCY_CONFLICT');
             (e as any).currentVersion = currentVersion;
             throw e;
          }

          // 3. Apply Business Mutations
          if (event.eventType === 'POS_SESSION_STARTED') {
             const existingSession = await tx.posSession.findUnique({ where: { id: event.aggregateId }});
             if (!existingSession) {
                 await tx.posSession.create({
                     data: {
                         id: event.aggregateId,
                         propertyId: payload.PropertyId || terminal.propertyId,
                         outletId: payload.OutletId || terminal.outletId,
                         deviceId: payload.DeviceId || event.deviceId,
                         bankingModel: payload.BankingModel || 'SERVER_BANKING',
                         bankType: payload.BankType || 'SERVER',
                         primaryOperatorId: payload.PrimaryOperatorId || event.operatorId,
                         openedBy: payload.UserId || event.operatorId,
                         status: payload.Status || 'OPEN',
                         businessDate: new Date(payload.OpenedAt || event.occurredAt),
                         openingCash: payload.OpeningCash || 0,
                         expectedCash: payload.OpeningCash || 0,
                         openedAt: new Date(payload.OpenedAt || event.occurredAt)
                     }
                 });
             }
             
             // Also create the Operator Session
             const existingOpSession = await tx.posOperatorSession.findUnique({ where: { id: event.aggregateId }});
             if (!existingOpSession) {
                 await tx.posOperatorSession.create({
                     data: {
                         id: event.aggregateId,
                         terminalId: event.deviceId,
                         outletId: terminal.outletId,
                         operatorId: event.operatorId,
                         status: "ACTIVE",
                         startedAt: new Date(event.occurredAt)
                     }
                 });
             }
          }
                    else if (event.eventType === 'ORDER_CREATED') {
             const existingOrder = await tx.posOrder.findUnique({ where: { id: event.aggregateId }});
             if (!existingOrder) {
                 const tableId = payload.TableId || null;
                 
                 // If the order has a table, try to occupy it atomically
                 if (tableId) {
                     const updateResult = await tx.posTable.updateMany({
                         where: {
                             id: tableId,
                             OR: [
                                 { currentOrderId: null },
                                 { currentOrderId: event.aggregateId }
                             ]
                         },
                         data: { currentOrderId: event.aggregateId }
                     });
                     
                     if (updateResult.count === 0) {
                         // Table is already occupied by someone else! Conflict.
                         await tx.syncConflict.create({
                             data: {
                                 propertyId,
                                 aggregateType: 'POS_ORDER',
                                 aggregateId: event.aggregateId,
                                 conflictReason: `Table ${tableId} is already occupied by another order.`,
                                 localData: payload,
                                 cloudData: {},
                                 status: 'PENDING'
                             }
                         });
                         // We must throw to trigger the CONFLICT state in the desktop's sync engine
                         const e = new Error('CONCURRENCY_CONFLICT');
                         (e as any).currentVersion = event.aggregateVersion;
                         throw e;
                     }
                 }
                 
                 await tx.posOrder.create({
                     data: {
                         id: event.aggregateId,
                         propertyId: propertyId,
                         outletId: payload.OutletId || terminal.outletId,
                         sessionId: payload.SessionId,
                         orderNumber: payload.OrderNumber,
                         status: payload.Status || 'SUBMITTED',
                         subtotal: payload.Subtotal || 0,
                         taxAmount: payload.TaxAmount || 0,
                         total: payload.Total || 0,
                         tableId: tableId,
                         businessDate: new Date(payload.BusinessDate || new Date()),
                         serverStaffId: event.operatorId,
                         createdAt: new Date(event.occurredAt)
                     }
                 });
             }
          }
          else if (event.eventType === 'ORDER_UPDATED') {
              await tx.posOrder.update({
                  where: { id: event.aggregateId },
                  data: { status: payload.status || payload.Status, notes: payload.notes || payload.Notes, updatedAt: new Date() }
              });
              
              const newStatus = payload.status || payload.Status;
              if (newStatus === 'CLOSED' || newStatus === 'CANCELLED' || newStatus === 'VOIDED') {
                  await tx.posTable.updateMany({
                      where: { currentOrderId: event.aggregateId },
                      data: { currentOrderId: null }
                  });
              }
          }
          else if (event.eventType === 'PAYMENT_RECORDED') {
              const method = payload.Method || payload.method || 'CASH';
              await tx.posPayment.create({
                  data: {
                      id: payload.Id || payload.id || crypto.randomUUID(), // If entityId was the order, payment needs its own ID
                      orderId: payload.OrderId || payload.orderId || event.aggregateId,
                      amount: payload.Amount ?? payload.amount,
                      method: method,
                      currency: payload.Currency || payload.currency || 'NGN',
                      status: "CONFIRMED",
                      operationId: event.idempotencyKey,
                      businessDate: new Date(payload.BusinessDate || payload.businessDate || new Date()),
                      sessionId: payload.SessionId || payload.sessionId || null,
                      processedById: event.operatorId || payload.processedById || null,
                      createdAt: new Date(event.occurredAt)
                  }
              });
              // Note: SERVER_BANKING logic runs separately (e.g. at end of shift/cash drop),
              // but we ensure non-cash doesn't increment cash balances.
          }
          else if (event.eventType === 'REFUND_REQUESTED') {
              const amount = Math.abs(Number(payload.Amount ?? payload.amount));
              if (!Number.isFinite(amount) || amount <= 0) throw new Error('Refund amount must be positive');
              await tx.approvalRequest.create({
                data: {
                  propertyId: event.propertyId,
                  type: 'REFUND',
                  status: 'PENDING',
                  requestedBy: event.operatorId,
                  amount,
                  currency: payload.Currency || payload.currency || 'NGN',
                  reason: payload.Reason || payload.reason || 'POS refund request',
                  details: {
                    posRefund: true,
                    orderId: payload.OrderId || payload.orderId || event.aggregateId,
                    method: payload.Method || payload.method || 'CASH',
                    amount,
                    sourceEventId: event.id,
                    sourceIdempotencyKey: event.idempotencyKey
                  }
                }
              });
          }
          else if (event.eventType === 'ORDER_CLOSED') {
              await tx.posOrder.update({
                  where: { id: event.aggregateId },
                  data: { status: "CLOSED", updatedAt: new Date() }
              });
              await tx.posTable.updateMany({
                  where: { currentOrderId: event.aggregateId },
                  data: { currentOrderId: null }
              });
          }
          else if (event.eventType === 'ORDER_ITEMS_ADDED') {
              const items = Array.isArray(payload) ? payload : (payload.Items || [payload]);
              for (const item of items) {
                  await tx.posOrderItem.create({
                      data: {
                          id: item.Id || crypto.randomUUID(),
                          orderId: item.OrderId || event.aggregateId,
                          productId: item.ProductId,
                          productName: item.ProductName,
                          quantity: item.Quantity,
                          unitPrice: item.UnitPrice,
                          subtotal: item.Subtotal,
                          discount: item.Discount || 0,
                          taxRate: item.TaxRate || 0,
                          taxAmount: item.TaxAmount || 0,
                          total: item.Total,
                          notes: item.Notes,
                          course: item.Course
                      }
                  });
              }
              if (items.length > 0) {
                  const orderId = items[0].OrderId || event.aggregateId;
                  const currentOrder = await tx.posOrder.findUnique({ where: { id: orderId } });
                  if (currentOrder) {
                      await tx.posOrder.update({
                          where: { id: orderId },
                          data: {
                              subtotal: Number(currentOrder.subtotal) + items.reduce((sum: number, i: any) => sum + Number(i.Subtotal), 0),
                              taxAmount: Number(currentOrder.taxAmount) + items.reduce((sum: number, i: any) => sum + Number(i.TaxAmount || 0), 0),
                              total: Number(currentOrder.total) + items.reduce((sum: number, i: any) => sum + Number(i.Total), 0)
                          }
                      });
                  }
              }
          }
          else if (event.eventType === 'KOT_CREATED') {
              await tx.posProductionBatch.create({
                  data: {
                      id: payload.Id || crypto.randomUUID(),
                      orderId: payload.OrderId || event.aggregateId,
                      batchNumber: payload.BatchNumber || '1',
                      station: payload.Station || "KITCHEN",
                      firedAt: new Date(event.occurredAt),
                      firedByStaffId: event.operatorId,
                      items: {
                          create: (payload.Items || []).map((item: any) => ({
                              id: item.Id || crypto.randomUUID(),
                              orderItemId: item.OrderItemId,
                              productName: item.ProductName,
                              quantity: item.Quantity,
                              course: item.Course
                          }))
                      }
                  }
              });
          }
          else if (event.eventType === 'POS_SETTLEMENT') {
              const operationId = payload.OperationId || payload.operationId || event.idempotencyKey;
              
              const existing = await tx.posSettlement.findUnique({
                  where: { operationId }
              });
              if (existing) {
                  // Handled by outer duplicate check mostly, but for double safety
                  // we could just ignore
              } else {
                  const session = await tx.posOperatorSession.findUnique({
                      where: { id: payload.SessionId || payload.sessionId }
                  });
                  if (!session) throw new Error(`PosSession ${payload.SessionId} not found`);

                  await tx.posSettlement.create({
                      data: {
                          id: payload.Id || payload.id || crypto.randomUUID(),
                          sessionId: session.id,
                          propertyId: propertyId,
                          outletId: session.outletId,
                          deviceId: payload.DeviceId || payload.deviceId || event.deviceId,
                          sessionOwnerId: payload.SessionOwnerId || payload.sessionOwnerId || session.operatorId,
                          operatorId: payload.OperatorId || payload.operatorId || event.operatorId,
                          businessDate: payload.BusinessDate ? new Date(payload.BusinessDate) : session.startedAt,
                          expectedCash: Number(payload.ExpectedCash ?? payload.expectedCash ?? 0),
                          actualCash: Number(payload.ActualCash ?? payload.actualCash ?? 0),
                          variance: Number(payload.Variance ?? payload.variance ?? 0),
                          authorizerId: payload.AuthorizerId || payload.authorizerId || null,
                          settledAt: payload.SettledAt ? new Date(payload.SettledAt) : new Date(event.occurredAt),
                          status: payload.Status || 'SETTLED',
                          operationId,
                      }
                  });

                  await tx.posOperatorSession.update({
                      where: { id: session.id },
                      data: {
                          status: 'CLOSED',
                          actualCash: Number(payload.ActualCash ?? payload.actualCash ?? 0),
                          variance: Number(payload.Variance ?? payload.variance ?? 0),
                          closedAt: payload.SettledAt ? new Date(payload.SettledAt) : new Date(event.occurredAt),
                          closedBy: payload.OperatorId || payload.operatorId || null,
                      }
                  });
              }
          }
          else if (event.eventType === 'POS_CASH_MOVEMENT' || event.eventType === 'CASH_MOVEMENT') {
              const operationId = payload.OperationId || payload.operationId || event.idempotencyKey;

              const existing = await tx.posCashMovement.findFirst({
                  where: { operationId }
              });
              if (!existing) {
                  const session = await tx.posOperatorSession.findUnique({
                      where: { id: payload.PosSessionId || payload.posSessionId }
                  });
                  if (!session) {
                      throw new Error(`Session ${payload.PosSessionId} not found for cash movement`);
                  }

                  await tx.posCashMovement.create({
                      data: {
                          id: payload.Id || payload.id || crypto.randomUUID(),
                          propertyId: propertyId,
                          posSessionId: session.id,
                          deviceId: payload.DeviceId || payload.deviceId || event.deviceId,
                          userId: payload.UserId || payload.userId || event.operatorId,
                          amount: Number(payload.Amount ?? payload.amount ?? 0),
                          type: payload.Type || payload.type || 'CASH_IN',
                          reasonCode: payload.ReasonCode || payload.reasonCode || 'MANUAL',
                          operationId,
                          authorizedBy: payload.AuthorizedBy || payload.authorizedBy || null,
                      }
                  });
              }
          }

          // 4. Save Immutable HotelEvent
          await tx.hotelEvent.create({
            data: {
              id: event.id,
              idempotencyKey: event.idempotencyKey,
              propertyId: event.propertyId,
              deviceId: event.deviceId,
              operatorId: event.operatorId,
              aggregateType: event.aggregateType,
              aggregateId: event.aggregateId,
              aggregateVersion: event.aggregateVersion,
              eventType: event.eventType,
              occurredAt: new Date(event.occurredAt || Date.now()),
              sequence: event.sequence,
              payload: payload
            }
          });

          // Optional: Record in Legacy PosProcessedEvent for strict backward compatibility monitoring
          // (Can be removed in Phase 3.7)
          await tx.posProcessedEvent.create({
            data: {
              eventId: event.idempotencyKey,
              terminalId: event.deviceId,
              outletId: terminal.outletId,
              sessionId: payload.SessionId || null,
              operatorId: event.operatorId || null,
              entityType: event.aggregateType,
              entityId: event.aggregateId,
              operation: event.eventType,
              payload: payload,
              createdAt: new Date()
            }
          });

          accepted.push(event.id);
          results.push({ id: event.id, status: 'SYNCED', idempotencyKey: event.idempotencyKey });
          lastSequenceNumber = event.sequence;
        });
        
      } catch (err: any) {
        if (err.message === 'IDEMPOTENCY_DUPLICATE') {
           alreadyProcessed.push(event.id);
           results.push({ id: event.id, status: err.existingEvent?.syncConflict ? 'CONFLICT' : 'SYNCED', idempotencyKey: event.idempotencyKey });
        } else if (err.message === 'CONCURRENCY_CONFLICT' || err.code === 'P2002') {
           let expectedVersion = err.currentVersion || event.aggregateVersion;
           try {
             await prisma.$transaction(async (tx2: any) => {
                const ev = await tx2.hotelEvent.create({
                  data: {
                    id: event.id,
                    idempotencyKey: event.idempotencyKey,
                    propertyId: event.propertyId,
                    deviceId: event.deviceId,
                    operatorId: event.operatorId,
                    aggregateType: event.aggregateType,
                    aggregateId: event.aggregateId,
                    aggregateVersion: event.aggregateVersion,
                    eventType: event.eventType,
                    occurredAt: new Date(event.occurredAt || Date.now()),
                    sequence: event.sequence,
                    payload: typeof event.payloadJson === 'string' ? JSON.parse(event.payloadJson || '{}') : event.payloadJson
                  }
                });
                
                await tx2.syncConflict.create({
                  data: {
                    propertyId: event.propertyId,
                    hotelEventId: ev.id,
                    aggregateType: event.aggregateType,
                    aggregateId: event.aggregateId,
                    expectedVersion: expectedVersion,
                    receivedVersion: event.aggregateVersion,
                    conflictReason: 'Optimistic Concurrency Failure: POS terminal operated on stale state.',
                    status: 'PENDING'
                  }
                });
             });
             conflicts.push(event.id);
             results.push({ id: event.id, status: 'CONFLICT', idempotencyKey: event.idempotencyKey, error: 'Concurrency conflict. Manager resolution required.' });
           } catch (conflictErr: any) {
             rejected.push(event.id);
             results.push({ id: event.id, status: 'FAILED', idempotencyKey: event.idempotencyKey, error: 'Failed to record conflict state.' });
           }
        } else {
           console.error(`Error processing POS event ${event.id}:`, err);
           rejected.push(event.id);
           results.push({ id: event.id, status: 'FAILED', idempotencyKey: event.idempotencyKey, error: err.message });
        }
      }
    }

    console.info(`[sync/pos-push] request=${requestId} completed accepted=${accepted.length} alreadyProcessed=${alreadyProcessed.length} rejected=${rejected.length} conflicts=${conflicts.length}`);
    return NextResponse.json({
      accepted,
      alreadyProcessed,
      rejected,
      conflicts,
      serverCursor: `seq_${lastSequenceNumber}`,
      results
    }, { status: 200 });

  } catch (error) {
    console.error(`[sync/pos-push] request=${requestId} failed`, error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
