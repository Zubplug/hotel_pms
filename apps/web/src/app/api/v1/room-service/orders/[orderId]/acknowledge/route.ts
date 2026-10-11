import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';
import { ProductionStation } from '@hotel-pms/db';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { successResponse, errorResponse } from '@/lib/api-response';

// POST /api/v1/room-service/orders/[orderId]/acknowledge
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return errorResponse('UNAUTHORIZED', 'Operator authorization token required', 401);
    }

    const payload = await verifyOperatorToken(token);
    if (!payload) {
      return errorResponse('UNAUTHORIZED', 'Invalid or expired operator token', 401);
    }

    const { staffId, propertyId, sessionId, outletId } = payload;
    if (!sessionId) {
      return errorResponse('SESSION_REQUIRED', 'An active open till session is required to accept room service orders', 409);
    }

    // Verify the operator till is open
    const activeSession = await prisma.posSession.findFirst({
      where: {
        id: sessionId,
        propertyId,
        status: 'OPEN',
        controlStatus: 'OPEN',
      },
      select: { id: true, businessDate: true },
    });

    if (!activeSession) {
      return errorResponse(
        'SESSION_CLOSED',
        'Your current POS shift till is closed or pending approval. Please open a till to accept orders.',
        409
      );
    }

    // Fetch the order
    const order = await prisma.posOrder.findUnique({
      where: { id: orderId },
      include: {
        items: { include: { modifiers: true } },
        productionBatches: true,
      },
    });

    if (!order) {
      return errorResponse('NOT_FOUND', 'Room service order not found', 404);
    }

    if (order.propertyId !== propertyId) {
      return errorResponse('FORBIDDEN', 'Order belongs to a different property', 403);
    }

    if (order.orderType !== 'ROOM_SERVICE') {
      return errorResponse('INVALID_ORDER_TYPE', 'Only room-service orders can use this acknowledgement endpoint', 400);
    }

    if (order.status === 'CLOSED' || order.status === 'VOIDED' || order.status === 'CANCELLED') {
      return errorResponse('INVALID_STATE', `Cannot acknowledge an order in ${order.status} state`, 400);
    }

    if (await isNightAuditTransactionLocked(propertyId, order.businessDate)) {
      return errorResponse(
        'LOCKED_BY_NIGHT_AUDIT',
        'Night audit is currently locking financial operations for this property',
        409
      );
    }

    // Fetch product stations
    const productIds = order.items
      .filter(i => i.productId)
      .map(i => i.productId!);

    const products = productIds.length > 0
      ? await prisma.posProduct.findMany({
          where: { id: { in: productIds } },
          select: {
            id: true,
            productionStation: true,
            category: { select: { productionStation: true } },
          },
        })
      : [];

    const productMap = new Map(products.map(p => [p.id, p]));

    // TypeScript needs a local non-null alias for use inside the transaction closure
    const confirmedOrder = order!;

    function resolveStation(item: (typeof confirmedOrder.items)[0]): ProductionStation {
      const prod = item.productId ? productMap.get(item.productId) : null;
      if (prod?.productionStation) return prod.productionStation as ProductionStation;
      if (prod?.category?.productionStation) return prod.category.productionStation as ProductionStation;
      return 'KITCHEN';
    }

    // Atomic execution with concurrency-safe KOT generation.
    //
    // Fix 2: Serializable isolation prevents two simultaneous acknowledgements
    // from both reading existingBatchesCount=0 and each creating duplicate KOT
    // batches.  The P2002 catch below is a belt-and-suspenders fallback in case
    // the database connection pool demotes the isolation level.
    let updated: any;
    try {
      updated = await prisma.$transaction(async (tx) => {
        const newBatches: any[] = [];
        let alreadyHadBatches = false;

        // Group items by station. Idempotency is scoped to room service only,
        // so normal TABLE orders remain free to create multiple KOT batches.
        const stationGroups = new Map<ProductionStation, Array<(typeof confirmedOrder.items)[0]>>();
        for (const item of confirmedOrder.items) {
          const station = resolveStation(item);
          if (station === 'DIRECT' || station === 'NONE') continue;
          if (!stationGroups.has(station)) stationGroups.set(station, []);
          stationGroups.get(station)!.push(item);
        }

        for (const [station, stationItems] of stationGroups) {
          const roomServiceOperationId = `kot_${orderId}_${station}`;
          const existingBatch = await tx.posProductionBatch.findUnique({
            where: { roomServiceOperationId },
            select: { id: true },
          });
          if (existingBatch) {
            alreadyHadBatches = true;
            continue;
          }

          const batch = await tx.posProductionBatch.create({
            data: {
              orderId,
              roomServiceOperationId,
              batchNumber: 1,
              station,
              status: 'PENDING',
              firedAt: new Date(),
              firedByStaffId: staffId,
              items: {
                create: stationItems.map(item => ({
                  orderItem: { connect: { id: item.id } },
                  productName: item.productName,
                  quantity: item.quantity,
                  modifiers: item.modifiers?.length ? item.modifiers : undefined,
                  course: item.course ?? 1,
                })),
              },
            },
            include: { items: true },
          });
          newBatches.push(batch);
        }

        if (newBatches.length > 0) {
          await tx.posOrderItem.updateMany({
            where: { orderId },
            data: { kitchenStatus: 'SENT', sentToKitchenAt: new Date() },
          });
        }

        // 3. Bind order to active session & staff, advance status to IN_SERVICE
        const orderUpdate = await tx.posOrder.update({
          where: { id: orderId },
          data: {
            sessionId,
            serverStaffId: staffId,
            status: 'IN_SERVICE',
            updatedAt: new Date(),
          },
          include: {
            items: { include: { modifiers: true } },
            productionBatches: { include: { items: true } },
          },
        });

        return {
          order: orderUpdate,
          batchesCreated: newBatches.length,
          alreadyHadBatches,
        };
      }, {
        // Serializable ensures the count() read and subsequent creates are atomic
        isolationLevel: 'Serializable' as any,
        timeout: 10_000,
      });
    } catch (txErr: any) {
      const prismaCode: string = txErr?.code ?? '';
      const errMsg: string     = txErr?.message ?? '';

      // P2002 / 23505 — room-service idempotency key caught a race.
      if (prismaCode === 'P2002' || errMsg.includes('Unique constraint') || errMsg.includes('23505')) {
        const existingOrder = await prisma.posOrder.findUnique({
          where: { id: orderId },
          include: {
            items: { include: { modifiers: true } },
            productionBatches: { include: { items: true } },
          },
        });
        return successResponse({
          order: existingOrder,
          batchesCreated: 0,
          alreadyHadBatches: true,
          message: 'Order already acknowledged by another session (concurrent request).',
        });
      }

      // P2034 / 40001 — PostgreSQL serialization failure:
      //   Two transactions conflicted at the Serializable level.  Retry once
      //   immediately; the retry will see existingBatchesCount > 0 and skip
      //   batch creation, returning the current order state.
      if (prismaCode === 'P2034' || errMsg.includes('40001') || errMsg.includes('could not serialize')) {
        try {
          const retryOrder = await prisma.posOrder.findUnique({
            where: { id: orderId },
            include: {
              items: { include: { modifiers: true } },
              productionBatches: { include: { items: true } },
            },
          });
          // If batches were already created by the winning transaction, return success.
          if (retryOrder && (retryOrder as any).productionBatches?.length > 0) {
            return successResponse({
              order: retryOrder,
              batchesCreated: 0,
              alreadyHadBatches: true,
              message: 'Order acknowledged (serialization retry — batches already dispatched).',
            });
          }
        } catch {
          // If the retry read itself fails, fall through and throw the original error.
        }
      }

      throw txErr;
    }


    return successResponse({
      order: updated.order,
      batchesCreated: updated.batchesCreated,
      alreadyHadBatches: updated.alreadyHadBatches,
      message: updated.alreadyHadBatches
        ? 'Order acknowledged (production batches were already dispatched).'
        : 'Order acknowledged and kitchen order tickets fired successfully.',
    });
  } catch (err: any) {
    console.error('[POST /api/v1/room-service/orders/[orderId]/acknowledge]', err);
    return errorResponse('INTERNAL_ERROR', err?.message || 'Failed to acknowledge order', 500);
  }
}
