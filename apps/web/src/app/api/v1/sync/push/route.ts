import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { NotificationEngine } from '@/lib/notification-engine';

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
    if (entityType === 'POS_ORDER' && operationType === 'CREATE') {
      // Idempotency
      const existingOrder = await prisma.posOrder.findUnique({
        where: { operationId: operationId }
      });
      if (existingOrder) {
        return NextResponse.json({ status: 'ALREADY_APPLIED', message: 'Idempotent replay' }, { status: 200 });
      }

      await prisma.$transaction(async (tx) => {
        // Create PosOrder
        const newOrder = await tx.posOrder.create({
          data: {
            id: entityId,
            propertyId: propertyId,
            outletId: payload.outletId,
            sessionId: payload.sessionId,
            folioId: payload.folioId,
            orderNumber: payload.orderNumber,
            status: payload.status,
            businessDate: desktopBusinessDate || new Date(),
            subtotal: payload.subtotal,
            taxAmount: payload.taxAmount || 0,
            total: payload.total,
            notes: payload.notes,
            tableNumber: payload.tableNumber,
            tableId: payload.tableId,
            guestCount: payload.guestCount || 1,
            serviceCharge: payload.serviceCharge || 0,
            tipAmount: payload.tipAmount || 0,
            serverStaffId: payload.serverStaffId,
            createdBy: payload.createdBy,
            updatedBy: payload.updatedBy,
            operationId: operationId,
            deviceId: deviceId,
            
            // Map items
            items: {
              create: payload.items.map((item: any) => ({
                id: item.id,
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                taxRate: item.taxRate || 0,
                taxAmount: item.taxAmount || 0,
                total: item.total,
                subtotal: item.quantity * item.unitPrice,
                course: item.course,
                kitchenStatus: item.kitchenStatus,
                sentToKitchenAt: item.sentToKitchenAt ? new Date(item.sentToKitchenAt) : null,
                voidReason: item.voidReason,
                kotId: item.kotId,
                checkId: item.checkId,
                modifiers: {
                  create: item.modifiers?.map((mod: any) => ({
                    id: mod.id,
                    name: mod.name,
                    price: mod.price
                  })) || []
                }
              }))
            },
            
            // Map checks (if any)
            checks: {
              create: payload.checks?.map((check: any) => ({
                id: check.id,
                checkNumber: check.checkNumber,
                total: check.total,
                status: check.status
              })) || []
            },

            // Map KOTs (if any)
            kots: {
              create: payload.kots?.map((kot: any) => ({
                id: kot.id,
                outletId: kot.outletId,
                deviceId: kot.deviceId,
                createdBy: kot.createdBy,
                kotNumber: kot.kotNumber,
                status: kot.status,
                printStatus: kot.printStatus,
                printerId: kot.printerId,
                attemptCount: kot.attemptCount,
                printedAt: kot.printedAt ? new Date(kot.printedAt) : null,
              })) || []
            },
            
            // Map payments
            payments: {
              create: payload.payments.map((pmt: any) => ({
                id: pmt.id,
                method: pmt.method,
                status: pmt.status,
                amount: pmt.amount,
                currency: pmt.currency || 'NGN',
                operationId: pmt.operationId || `${operationId}_pmt_${pmt.id}`,
                deviceId: deviceId
              }))
            }
          }
        });

        // Authoritative Recipe Explosion
        for (const item of payload.items) {
          if (!item.productId) continue;
          
          const ingredients = await tx.recipeIngredient.findMany({
            where: { productId: item.productId },
            include: { stockItem: true }
          });
          
          for (const ing of ingredients) {
            const deductQty = Number(ing.quantity) * Number(item.quantity);
            
            const updatedStockItem = await tx.stockItem.update({
              where: { id: ing.stockItemId },
              data: { quantityOnHand: { decrement: deductQty } }
            });
            
            if (Number(updatedStockItem.quantityOnHand) < 0) {
              const existingAlert = await tx.inventoryAlert.findFirst({
                where: {
                  propertyId: propertyId,
                  stockItemId: ing.stockItemId,
                  status: 'OPEN',
                  type: 'NEGATIVE_STOCK'
                }
              });
              
              if (!existingAlert) {
                await tx.inventoryAlert.create({
                  data: {
                    propertyId: propertyId,
                    stockItemId: ing.stockItemId,
                    type: 'NEGATIVE_STOCK',
                    message: `Stock balance dropped to ${updatedStockItem.quantityOnHand} due to offline POS sale ${newOrder.orderNumber}.`,
                    status: 'OPEN'
                  }
                });

                await NotificationEngine.emit({
                  type: 'CRITICAL_STOCKOUT',
                  organizationId: property.organizationId,
                  propertyId: property.id,
                  entityType: 'stockItem',
                  entityId: ing.stockItemId,
                  idempotencyKey: `stockout_${ing.stockItemId}_${Date.now()}`
                });
              }
            }
            
            await tx.stockTransaction.create({
              data: {
                propertyId: propertyId,
                stockItemId: ing.stockItemId,
                source: 'SALE',
                quantity: -deductQty,
                unitCost: ing.stockItem.costPrice,
                reference: newOrder.orderNumber,
                notes: `POS Sale deduplicated via cloud`,
                businessDate: desktopBusinessDate || new Date(),
                operationId: `${operationId}_ing_${ing.id}`, // Deterministic per ingredient
                deviceId: deviceId,
                userId: userId
              }
            });
          }
        }
      });
    } else if (entityType === 'POS_ORDER' && operationType === 'UPDATE') {
      // Idempotency
      const idempotencyRecord = await prisma.posOrder.findUnique({
        where: { operationId: operationId }
      });
      // If the operationId already matches, we've already applied this exact update.
      // But typically for updates, operationId should be unique per update.
      // Assuming C# generates a new operationId for every push of the order.
      if (idempotencyRecord) {
        return NextResponse.json({ status: 'ALREADY_APPLIED', message: 'Idempotent replay' }, { status: 200 });
      }

      await prisma.$transaction(async (tx) => {
        // Update Order core fields
        await tx.posOrder.update({
          where: { id: entityId },
          data: {
            status: payload.status,
            subtotal: payload.subtotal,
            taxAmount: payload.taxAmount || 0,
            total: payload.total,
            notes: payload.notes,
            tableNumber: payload.tableNumber,
            tableId: payload.tableId,
            guestCount: payload.guestCount || 1,
            serviceCharge: payload.serviceCharge || 0,
            tipAmount: payload.tipAmount || 0,
            updatedBy: payload.updatedBy,
            operationId: operationId,
          }
        });

        // Upsert items (only adding new items or updating statuses)
        for (const item of payload.items) {
          await tx.posOrderItem.upsert({
            where: { id: item.id },
            update: {
              quantity: item.quantity,
              total: item.total,
              subtotal: item.quantity * item.unitPrice,
              course: item.course,
              kitchenStatus: item.kitchenStatus,
              sentToKitchenAt: item.sentToKitchenAt ? new Date(item.sentToKitchenAt) : null,
              voidReason: item.voidReason,
              kotId: item.kotId,
              checkId: item.checkId,
            },
            create: {
              id: item.id,
              orderId: entityId,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              taxRate: item.taxRate || 0,
              taxAmount: item.taxAmount || 0,
              total: item.total,
              subtotal: item.quantity * item.unitPrice,
              course: item.course,
              kitchenStatus: item.kitchenStatus,
              sentToKitchenAt: item.sentToKitchenAt ? new Date(item.sentToKitchenAt) : null,
              voidReason: item.voidReason,
              kotId: item.kotId,
              checkId: item.checkId,
              modifiers: {
                create: item.modifiers?.map((mod: any) => ({
                  id: mod.id,
                  name: mod.name,
                  price: mod.price
                })) || []
              }
            }
          });
        }

        // Upsert KOTs
        if (payload.kots) {
          for (const kot of payload.kots) {
            await tx.posKot.upsert({
              where: { id: kot.id },
              update: {
                status: kot.status,
                printStatus: kot.printStatus,
                attemptCount: kot.attemptCount,
                printedAt: kot.printedAt ? new Date(kot.printedAt) : null,
              },
              create: {
                id: kot.id,
                orderId: entityId,
                outletId: kot.outletId,
                deviceId: kot.deviceId,
                createdBy: kot.createdBy,
                kotNumber: kot.kotNumber,
                status: kot.status,
                printStatus: kot.printStatus,
                printerId: kot.printerId,
                attemptCount: kot.attemptCount,
                printedAt: kot.printedAt ? new Date(kot.printedAt) : null,
                businessDate: kot.businessDate ? new Date(kot.businessDate) : (desktopBusinessDate || new Date()),
              }
            });
          }
        }
      });
    } else if (entityType === 'POS_KOT') {
      // Direct KOT sync
      if (operationType === 'CREATE') {
        const existingKot = await prisma.posKot.findUnique({
          where: { id: entityId }
        });
        if (existingKot) {
          return NextResponse.json({ status: 'ALREADY_APPLIED', message: 'Idempotent replay' }, { status: 200 });
        }
        await prisma.posKot.create({
          data: {
            id: entityId,
            orderId: payload.orderId,
            outletId: payload.outletId,
            deviceId: payload.deviceId,
            createdBy: payload.createdBy,
            kotNumber: payload.kotNumber,
            status: payload.status,
            printStatus: payload.printStatus,
            printerId: payload.printerId,
            attemptCount: payload.attemptCount,
            printedAt: payload.printedAt ? new Date(payload.printedAt) : null,
            businessDate: payload.businessDate ? new Date(payload.businessDate) : (desktopBusinessDate || new Date()),
          }
        });
      } else if (operationType === 'UPDATE') {
        await prisma.posKot.update({
          where: { id: entityId },
          data: {
            status: payload.status,
            printStatus: payload.printStatus,
            attemptCount: payload.attemptCount,
            printedAt: payload.printedAt ? new Date(payload.printedAt) : null,
          }
        });
      }
    } else if (entityType === 'FOLIO' && operationType === 'ADD_PAYMENT') {
      const existingPayment = await prisma.payment.findUnique({
        where: { idempotencyKey: operationId }
      });
      if (existingPayment) {
        return NextResponse.json({ status: 'ALREADY_APPLIED', message: 'Idempotent replay' }, { status: 200 });
      }

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
        data: { totalPayments: { increment: payload.amount } }
      });
      
      // Emit Notification Event
      await NotificationEngine.emit({
        type: 'PAYMENT_LARGE',
        organizationId: property.organizationId,
        propertyId: property.id,
        entityType: 'payment',
        entityId: entityId,
        idempotencyKey: `payment_large_${entityId}`,
      });
      
    } else if (entityType === 'FOLIO' && operationType === 'ADD_ROOM_CHARGE') {
      const existingCharge = await prisma.folioItem.findFirst({
        where: { operationId: operationId }
      });
      if (existingCharge) {
        return NextResponse.json({ status: 'ALREADY_APPLIED', message: 'Idempotent replay' }, { status: 200 });
      }

      const folio = await prisma.folio.findUnique({
        where: { id: payload.folioId }
      });
      
      if (!folio || folio.status === 'CLOSED') {
        // Generate SyncConflict for Manager Review
        await prisma.syncConflict.create({
          data: {
            propertyId: propertyId,
            operationId: operationId,
            entityType: 'FOLIO',
            entityId: payload.folioId,
            payload: payloadJson,
            conflictReason: 'Folio is closed or does not exist. MANAGER_REVIEW required.',
            status: 'PENDING'
          }
        });
        
        return NextResponse.json({ error: 'Folio is closed', status: 'CONFLICT' }, { status: 409 });
      }

      await prisma.folioItem.create({
        data: {
          id: entityId,
          folioId: payload.folioId,
          businessDate: isLatePosting && property.businessDate ? property.businessDate : (desktopBusinessDate || new Date()),
          type: 'CHARGE',
          source: payload.source || 'POS',
          description: payload.description,
          unitAmount: payload.amount,
          amount: payload.amount,
          currency: payload.currency || property.baseCurrency,
          baseAmount: payload.amount,
          postedBy: userId,
          
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
    } else if (entityType === 'POS_SESSION') {
      const existingSession = await prisma.posSession.findUnique({
        where: { id: entityId }
      });

      if (existingSession && operationType === 'CREATE') {
        return NextResponse.json({ status: 'ALREADY_APPLIED' }, { status: 200 });
      }

      await prisma.$transaction(async (tx) => {
        if (operationType === 'CREATE' || !existingSession) {
          await tx.posSession.create({
            data: {
              id: entityId,
              propertyId: propertyId,
              deviceId: deviceId,
              openedBy: payload.userId || userId,
              status: payload.status,
              openedAt: new Date(payload.openedAt),
              openingCash: payload.openingBalance || payload.openingCash || 0,
              businessDate: desktopBusinessDate || new Date(),
              outletId: payload.outletId || 'unknown-outlet'
            }
          });
        } else if (operationType === 'UPDATE' && payload.status === 'CLOSED') {
          // Server-side Settlement Calculation
          const cashPayments = await tx.posPayment.aggregate({
            _sum: { amount: true },
            where: {
              method: 'CASH',
              order: { sessionId: entityId },
              status: { in: ['CONFIRMED', 'PAID'] }
            }
          });
          const cashRefunds = await tx.posPayment.aggregate({
            _sum: { amount: true },
            where: {
              method: 'CASH',
              order: { sessionId: entityId },
              status: 'REFUNDED' 
            }
          });
          
          const cashMovements = await tx.posCashMovement.findMany({
            where: { posSessionId: entityId }
          });
          
          let transferIn = 0;
          let paidOut = 0;
          let transferOut = 0;
          let cashDrops = 0;
          let floatAdjustments = 0;

          for (const m of cashMovements) {
            const amt = Number(m.amount);
            if (m.type === 'CASH_TRANSFER_IN') transferIn += amt;
            else if (m.type === 'PAID_OUT') paidOut += amt;
            else if (m.type === 'CASH_TRANSFER_OUT') transferOut += amt;
            else if (m.type === 'CASH_DROP') cashDrops += amt;
            else if (m.type === 'FLOAT_ADJUSTMENT') floatAdjustments += amt;
          }

          const totalSales = Number(cashPayments._sum.amount || 0);
          const totalRefunds = Number(cashRefunds._sum.amount || 0);
          
          // Formula: Opening + Sales - Refunds + TransferIn - PaidOut - TransferOut - Drops ± Float Adjustments
          const expectedCash = Number(existingSession.openingCash || 0) 
            + totalSales 
            - totalRefunds 
            + transferIn 
            - paidOut 
            - transferOut 
            - cashDrops 
            + floatAdjustments;
            
          const actualCash = Number(payload.actualCash || 0);
          const variance = actualCash - expectedCash;

          await tx.posSession.update({
            where: { id: entityId },
            data: {
              status: 'CLOSED',
              closedAt: payload.closedAt ? new Date(payload.closedAt) : new Date(),
              cashSales: totalSales,
              cashRefunds: totalRefunds,
              cashIn: transferIn,
              cashOut: paidOut + transferOut + cashDrops,
              expectedCash: expectedCash,
              actualCash: actualCash,
              variance: variance
            }
          });

          if (variance !== 0) {
            await NotificationEngine.emit({
              type: 'CASH_VARIANCE',
              organizationId: property.organizationId,
              propertyId: property.id,
              entityType: 'posSession',
              entityId: entityId,
              idempotencyKey: `cash_variance_${entityId}`,
              metadata: { varianceAmount: variance }
            });
          }
        }
      });
    } else if (entityType === 'POS_VOID') {
      const existingVoid = await prisma.posVoid.findUnique({
        where: { operationId: operationId }
      });
      if (existingVoid) {
        return NextResponse.json({ status: 'ALREADY_APPLIED' }, { status: 200 });
      }

      await prisma.$transaction(async (tx) => {
        await tx.posVoid.create({
          data: {
            id: entityId,
            orderId: payload.orderId,
            orderItemId: payload.orderItemId,
            reason: payload.reason,
            authorizerId: payload.authorizerId,
            operationId: operationId,
            deviceId: deviceId,
            businessDate: payload.businessDate ? new Date(payload.businessDate) : (desktopBusinessDate || new Date()),
          }
        });

        // Determine if inventory needs to be restored
        const originalSales = await tx.stockTransaction.findMany({
          where: {
            reference: { contains: payload.orderNumber || payload.orderId },
            source: 'SALE',
            // If item level, filter by the operationId substring or item ref
          }
        });

        for (const sale of originalSales) {
          // Verify we haven't already returned this exact sale
          const returnOpId = `${operationId}_return_${sale.id}`;
          const existingReturn = await tx.stockTransaction.findFirst({
            where: { operationId: returnOpId }
          });
          
          if (!existingReturn) {
            await tx.stockTransaction.create({
              data: {
                propertyId: propertyId,
                stockItemId: sale.stockItemId,
                source: 'POS_VOID',
                quantity: Math.abs(Number(sale.quantity)), // restore
                unitCost: sale.unitCost,
                reference: sale.reference,
                notes: `Void RESTORE: ${payload.reason}`,
                businessDate: desktopBusinessDate || new Date(),
                operationId: returnOpId,
                deviceId: deviceId,
                userId: userId
              }
            });
            await tx.stockItem.update({
              where: { id: sale.stockItemId },
              data: { quantityOnHand: { increment: Math.abs(Number(sale.quantity)) } }
            });
          }
        }
      });
      
      // Check for High Value Refund Notification
      await NotificationEngine.emit({
        type: 'REFUND_HIGH_VALUE',
        organizationId: property.organizationId,
        propertyId: property.id,
        entityType: 'posVoid',
        entityId: entityId,
        idempotencyKey: `pos_void_${entityId}`,
        metadata: {
          isManagerOverride: !!payload.authorizerId
        }
      });
      
    } else if (entityType === 'POS_DISCOUNT') {
      const existingDiscount = await prisma.posDiscount.findUnique({
        where: { operationId: operationId }
      });
      if (existingDiscount) {
        return NextResponse.json({ status: 'ALREADY_APPLIED' }, { status: 200 });
      }
      
      await prisma.posDiscount.create({
        data: {
          id: entityId,
          orderId: payload.orderId,
          orderItemId: payload.orderItemId,
          type: payload.type,
          amount: payload.amount,
          authorizerId: payload.authorizerId,
          operationId: operationId,
          deviceId: deviceId,
          businessDate: payload.businessDate ? new Date(payload.businessDate) : (desktopBusinessDate || new Date()),
        }
      });
    } else if (entityType === 'POS_CASH_MOVEMENT') {
      const existingMovement = await prisma.posCashMovement.findUnique({
        where: { operationId: operationId }
      });
      if (existingMovement) {
        return NextResponse.json({ status: 'ALREADY_APPLIED' }, { status: 200 });
      }

      await prisma.posCashMovement.create({
        data: {
          id: entityId,
          propertyId: propertyId,
          deviceId: deviceId,
          posSessionId: payload.posSessionId,
          userId: payload.userId,
          amount: payload.amount,
          type: payload.type,
          reasonCode: payload.reasonCode,
          notes: payload.notes,
          receiptReference: payload.receiptReference,
          operationId: operationId,
          authorizedBy: payload.authorizedBy
        }
      });
    } else if (entityType === 'POS_RECEIPT_AUDIT') {
      const existingAudit = await prisma.posReceiptAudit.findUnique({
        where: { operationId: operationId }
      });
      if (existingAudit) {
        return NextResponse.json({ status: 'ALREADY_APPLIED' }, { status: 200 });
      }

      await prisma.posReceiptAudit.create({
        data: {
          id: entityId,
          propertyId: propertyId,
          orderId: payload.orderId,
          deviceId: deviceId,
          posSessionId: payload.posSessionId,
          userId: payload.userId,
          type: payload.type,
          reason: payload.reason,
          printCount: payload.printCount,
          operationId: operationId,
          businessDate: payload.businessDate ? new Date(payload.businessDate) : (desktopBusinessDate || new Date())
        }
      });
    } else if (entityType === 'POS_AUTH_AUDIT') {
      const existingAuth = await prisma.posAuthorizationAudit.findUnique({
        where: { operationId: operationId }
      });
      if (existingAuth) {
        return NextResponse.json({ status: 'ALREADY_APPLIED' }, { status: 200 });
      }

      await prisma.posAuthorizationAudit.create({
        data: {
          id: entityId,
          propertyId: propertyId,
          deviceId: deviceId,
          sessionId: payload.sessionId,
          requestedBy: payload.requestedBy,
          authorizedBy: payload.authorizedBy,
          action: payload.action,
          reason: payload.reason,
          operationId: operationId,
          businessDate: payload.businessDate ? new Date(payload.businessDate) : (desktopBusinessDate || new Date())
        }
      });
    } else if (entityType === 'POS_SETTLEMENT') {
      const existingSettlement = await prisma.posSettlement.findUnique({
        where: { operationId: operationId }
      });
      if (existingSettlement) {
        return NextResponse.json({ status: 'ALREADY_APPLIED' }, { status: 200 });
      }

      await prisma.posSettlement.create({
        data: {
          id: entityId,
          sessionId: payload.sessionId,
          propertyId: propertyId,
          outletId: payload.outletId || 'unknown-outlet',
          deviceId: deviceId,
          sessionOwnerId: payload.sessionOwnerId,
          operatorId: payload.operatorId,
          businessDate: desktopBusinessDate || new Date(),
          expectedCash: payload.expectedCash,
          actualCash: payload.actualCash,
          variance: payload.variance,
          authorizerId: payload.authorizerId,
          settledAt: payload.settledAt ? new Date(payload.settledAt) : new Date(),
          status: payload.status,
          operationId: operationId
        }
      });
    }

    return NextResponse.json({ 
      status: 'SYNCED',
      cloudBusinessDate: property.businessDate 
    }, { status: 200 });

  } catch (error: any) {
    console.error('Sync Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
