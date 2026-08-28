import { NextRequest, NextResponse } from "next/server";
import prisma from "@hotel-pms/db";
import { randomUUID } from "crypto";
import { InventoryService } from "@/lib/inventory/InventoryService";

// Legacy desktop SyncEvents use operation IDs such as `op_<device>_<ticks>`,
// while HotelEvent.id is a PostgreSQL UUID. Keep the legacy ID as the
// idempotency key, but generate a separate UUID for the database primary key.
function isUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

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
      const hotelEventId = isUuid(event.id) ? event.id : randomUUID();
      // Legacy payloads may contain an operation ID in operatorId. Staff
      // foreign keys are UUIDs, so never pass an opaque legacy ID through.
      const operatorId = isUuid(event.operatorId) ? event.operatorId : null;

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
          
          // Legacy desktop SyncEvents do not carry aggregate versions. They
          // are already ordered by the terminal sequence, so do not apply the
          // newer OCC gate to them.
          const isCreationEvent = ['ORDER_CREATED', 'POS_SESSION_STARTED', 'POS_OPERATOR_SESSION_STARTED'].includes(event.eventType);
          let updatedCount = (isLegacy || isCreationEvent) ? 1 : 0;
          
          // 2. Lock & Verify OCC Version
          if (!isLegacy && !isCreationEvent) {
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
                         primaryOperatorId: isUuid(payload.PrimaryOperatorId) ? payload.PrimaryOperatorId : operatorId,
                         openedBy: isUuid(payload.UserId) ? payload.UserId : operatorId,
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
                         operatorId,
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
                 
                 const orderItems = payload.Items || payload.items || [];
                 const createdOrder = await tx.posOrder.create({
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
                         orderType: payload.OrderType || payload.orderType || 'DINE_IN',
                         tableId: tableId,
                         businessDate: new Date(payload.BusinessDate || new Date()),
                         serverStaffId: operatorId,
                         createdAt: new Date(event.occurredAt),
                         items: {
                           create: orderItems.map((item: any) => ({
                             id: item.Id || item.id || crypto.randomUUID(),
                             productId: item.ProductId || item.productId || null,
                             productName: item.ProductName || item.productName || 'POS item',
                             quantity: Number(item.Quantity ?? item.quantity ?? 0),
                             unitPrice: Number(item.UnitPrice ?? item.unitPrice ?? 0),
                             subtotal: Number(item.Subtotal ?? item.subtotal ?? item.Total ?? item.total ?? 0),
                             taxRate: Number(item.TaxRate ?? item.taxRate ?? 0),
                             taxAmount: Number(item.TaxAmount ?? item.taxAmount ?? 0),
                             total: Number(item.Total ?? item.total ?? 0),
                             course: item.Course ?? item.course ?? null,
                             kitchenStatus: item.KitchenStatus || item.kitchenStatus || 'PENDING',
                           }))
                         }
                     },
                     include: { items: true }
                 });

                 // Desktop ORDER_CREATED carries its KOTs inside the order
                 // payload. Preserve each station when materializing them in
                 // the cloud production queue.
                 const orderKots = payload.Kots || payload.kots || [];
                 for (const kot of orderKots) {
                   const itemIds = JSON.parse(kot.ItemIdsJson || kot.itemIdsJson || '[]');
                   const station = String(kot.ProductionStation || kot.productionStation || 'KITCHEN').toUpperCase();
                   const batchItems = createdOrder.items.filter((item: any) => itemIds.includes(item.id));
                   await tx.posProductionBatch.create({
                     data: {
                       id: kot.Id || kot.id || crypto.randomUUID(),
                       orderId: event.aggregateId,
                       batchNumber: 1,
                       station,
                       status: 'PENDING',
                       firedAt: new Date(kot.FiredAt || kot.firedAt || event.occurredAt),
                       firedByStaffId: operatorId,
                       items: {
                         create: batchItems.map((item: any) => ({
                           orderItemId: item.id,
                           productName: item.productName,
                           quantity: item.quantity,
                           course: item.course,
                         }))
                       }
                     }
                   });
                 }
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
              if (newStatus === 'CANCELLED' || newStatus === 'VOIDED') {
                await InventoryService.restoreSale(
                  event.aggregateId,
                  event.operatorId || 'desktop-sync',
                  `op_restore_${newStatus.toLowerCase()}_${event.aggregateId}`,
                  tx
                );
              }
              // ─── INVENTORY HOOK for ORDER_UPDATED → CLOSED ────────────────
              // Desktop sometimes uses ORDER_UPDATED with status=COMPLETED/CLOSED
              // instead of emitting a dedicated ORDER_CLOSED event. Catch both.
              if (newStatus === 'CLOSED' || newStatus === 'COMPLETED') {
                await InventoryService.commitSaleInTransaction(
                  tx,
                  event.aggregateId,
                  event.operatorId || 'desktop-sync',
                  `op_sale_desktop_${event.aggregateId}`
                );
              }
              // ─────────────────────────────────────────────────────────────
          }
          else if (event.eventType === 'PAYMENT_RECORDED') {
              const method = payload.Method || payload.method || 'CASH';
              const orderId = payload.OrderId || payload.orderId || event.aggregateId;
              const order = await tx.posOrder.findUnique({ where: { id: orderId }, select: { id: true } });
              if (!order) {
                  // A payment cannot be applied safely until ORDER_CREATED has
                  // been accepted. Leave it retryable instead of dead-lettering
                  // it with a misleading foreign-key error.
                  throw new Error(`RETRYABLE_ORDER_NOT_FOUND: POS order ${orderId} has not reached the cloud yet`);
              }
              await tx.posPayment.create({
                  data: {
                      id: payload.Id || payload.id || crypto.randomUUID(), // If entityId was the order, payment needs its own ID
                      orderId,
                      amount: payload.Amount ?? payload.amount,
                      method: method,
                      currency: payload.Currency || payload.currency || 'NGN',
                      status: "CONFIRMED",
                      operationId: event.idempotencyKey,
                      businessDate: new Date(payload.BusinessDate || payload.businessDate || new Date()),
                      sessionId: payload.SessionId || payload.sessionId || null,
                      processedById: isUuid(payload.processedById) ? payload.processedById : operatorId,
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
                  requestedBy: operatorId,
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
          else if (event.eventType === 'ORDER_CLOSED' || event.eventType === 'ORDER_COMPLETED') {
              await tx.posOrder.update({
                  where: { id: event.aggregateId },
                  data: { status: "CLOSED", updatedAt: new Date() }
              });
              await tx.posTable.updateMany({
                  where: { currentOrderId: event.aggregateId },
                  data: { currentOrderId: null }
              });
              // ─── INVENTORY HOOK ───────────────────────────────────────────
              // Deduct stock for all menu items with linked RecipeIngredients.
              // Uses a deterministic operationId so if the SyncEngine retries
              // this event it will be a no-op (idempotency guard inside postSale).
              await InventoryService.commitSaleInTransaction(
                tx,
                event.aggregateId,
                event.operatorId || 'desktop-sync',
                `op_sale_desktop_${event.aggregateId}`
              );
              // ─────────────────────────────────────────────────────────────
          }
          else if (event.eventType === 'ORDER_ITEMS_ADDED') {
              const nestedOrder = payload.order || payload.Order;
              const nestedKots = payload.kots || payload.Kots || [];
              const nestedItems = nestedOrder?.Items || nestedOrder?.items || [];
              const nestedItemIds = new Set<string>(nestedKots.flatMap((kot: any) => {
                try { return JSON.parse(kot.ItemIdsJson || kot.itemIdsJson || '[]'); } catch { return []; }
              }));
              const items = Array.isArray(payload)
                ? payload
                : (payload.Items || payload.items || (nestedItemIds.size
                  ? nestedItems.filter((item: any) => nestedItemIds.has(item.Id || item.id))
                  : nestedItems));
              for (const item of items) {
                  await tx.posOrderItem.create({
                      data: {
                          id: item.Id || item.id || crypto.randomUUID(),
                          orderId: item.OrderId || item.orderId || event.aggregateId,
                          productId: item.ProductId || item.productId || null,
                          productName: item.ProductName || item.productName || 'POS item',
                          quantity: Number(item.Quantity ?? item.quantity ?? 0),
                          unitPrice: Number(item.UnitPrice ?? item.unitPrice ?? 0),
                          subtotal: Number(item.Subtotal ?? item.subtotal ?? item.Total ?? item.total ?? 0),
                          discount: Number(item.Discount ?? item.discount ?? 0),
                          taxRate: Number(item.TaxRate ?? item.taxRate ?? 0),
                          taxAmount: Number(item.TaxAmount ?? item.taxAmount ?? 0),
                          total: Number(item.Total ?? item.total ?? 0),
                          notes: item.Notes || item.notes,
                          course: item.Course ?? item.course ?? null
                      }
                  });
              }
              if (items.length > 0) {
                  const orderId = items[0].OrderId || items[0].orderId || event.aggregateId;
                  const currentOrder = await tx.posOrder.findUnique({ where: { id: orderId } });
                  if (currentOrder) {
                      await tx.posOrder.update({
                          where: { id: orderId },
                          data: {
                            subtotal: Number(currentOrder.subtotal) + items.reduce((sum: number, i: any) => sum + Number(i.Subtotal ?? i.subtotal ?? i.Total ?? i.total ?? 0), 0),
                            taxAmount: Number(currentOrder.taxAmount) + items.reduce((sum: number, i: any) => sum + Number(i.TaxAmount ?? i.taxAmount ?? 0), 0),
                            total: Number(currentOrder.total) + items.reduce((sum: number, i: any) => sum + Number(i.Total ?? i.total ?? 0), 0)
                          }
                      });
                  }
              }

              for (const kot of nestedKots) {
                let itemIds: string[] = [];
                try { itemIds = JSON.parse(kot.ItemIdsJson || kot.itemIdsJson || '[]'); } catch { }
                const station = String(kot.ProductionStation || kot.productionStation || 'KITCHEN').toUpperCase();
                const batchItems = items.filter((item: any) => itemIds.includes(item.Id || item.id));
                await tx.posProductionBatch.create({
                  data: {
                    id: kot.Id || kot.id || crypto.randomUUID(),
                    orderId: event.aggregateId,
                    batchNumber: 1,
                    station,
                    status: 'PENDING',
                    firedAt: new Date(kot.FiredAt || kot.firedAt || event.occurredAt),
                    firedByStaffId: operatorId,
                    items: {
                      create: batchItems.map((item: any) => ({
                        orderItemId: item.Id || item.id,
                        productName: item.ProductName || item.productName || 'POS item',
                        quantity: Number(item.Quantity ?? item.quantity ?? 0),
                        course: item.Course ?? item.course ?? null,
                      }))
                    }
                  }
                });
              }
          }
          else if (event.eventType === 'KOT_CREATED') {
              // Desktop KOT events are wrapped as { kot, itemIds } and use
              // System.Text.Json property names. Accept both wrapped and flat
              // payloads so BAR station data is not lost during sync.
              const kot = payload.kot || payload.Kot || payload;
              const rawItems = payload.items || payload.Items || kot.items || kot.Items || [];
              const station = String(kot.productionStation || kot.ProductionStation
                  || payload.station || payload.Station || 'KITCHEN').toUpperCase();
              await tx.posProductionBatch.create({
                  data: {
                      id: kot.id || kot.Id || crypto.randomUUID(),
                      orderId: kot.orderId || kot.OrderId || event.aggregateId,
                      batchNumber: Number(kot.batchNumber || kot.BatchNumber || 1),
                      station,
                      firedAt: new Date(event.occurredAt),
                      firedByStaffId: operatorId,
                      items: {
                          create: rawItems.map((item: any) => ({
                              id: item.id || item.Id || crypto.randomUUID(),
                              orderItemId: item.orderItemId || item.OrderItemId,
                              productName: item.productName || item.ProductName,
                              quantity: item.quantity || item.Quantity,
                              course: item.course || item.Course
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
                          sessionOwnerId: isUuid(payload.SessionOwnerId || payload.sessionOwnerId) ? (payload.SessionOwnerId || payload.sessionOwnerId) : session.operatorId,
                          operatorId: isUuid(payload.OperatorId || payload.operatorId) ? (payload.OperatorId || payload.operatorId) : operatorId,
                          businessDate: payload.BusinessDate ? new Date(payload.BusinessDate) : session.startedAt,
                          expectedCash: Number(payload.ExpectedCash ?? payload.expectedCash ?? 0),
                          actualCash: Number(payload.ActualCash ?? payload.actualCash ?? 0),
                          variance: Number(payload.Variance ?? payload.variance ?? 0),
                          authorizerId: isUuid(payload.AuthorizerId || payload.authorizerId) ? (payload.AuthorizerId || payload.authorizerId) : null,
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
                          closedBy: isUuid(payload.OperatorId || payload.operatorId) ? (payload.OperatorId || payload.operatorId) : operatorId,
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
                          userId: isUuid(payload.UserId || payload.userId) ? (payload.UserId || payload.userId) : operatorId,
                          amount: Number(payload.Amount ?? payload.amount ?? 0),
                          type: payload.Type || payload.type || 'CASH_IN',
                          reasonCode: payload.ReasonCode || payload.reasonCode || 'MANUAL',
                          operationId,
                          authorizedBy: isUuid(payload.AuthorizedBy || payload.authorizedBy) ? (payload.AuthorizedBy || payload.authorizedBy) : null,
                      }
                  });
              }
          }

          // 4. Save Immutable HotelEvent
          await tx.hotelEvent.create({
            data: {
              id: hotelEventId,
              idempotencyKey: event.idempotencyKey,
              propertyId: event.propertyId,
              deviceId: event.deviceId,
              operatorId,
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
                    id: hotelEventId,
                    idempotencyKey: event.idempotencyKey,
                    propertyId: event.propertyId,
                    deviceId: event.deviceId,
                    operatorId,
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
        } else if (err.message?.startsWith('RETRYABLE_')) {
           rejected.push(event.id);
           results.push({ id: event.id, status: 'RETRY', idempotencyKey: event.idempotencyKey, error: err.message });
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
