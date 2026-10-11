import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import { successResponse, errorResponse } from '@/lib/api-response';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';
import { verifyRoomQrToken } from '@/lib/room-service/qrToken';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v1/room-service/orders
//
// Fix 3: Requires a valid operator Bearer token.  propertyId is now read from
// the verified token payload — not from the client-supplied query string.
// ─────────────────────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '').trim();

    if (!token) {
      return errorResponse('UNAUTHORIZED', 'Operator authorization token required', 401);
    }

    const payload = await verifyOperatorToken(token);
    if (!payload) {
      return errorResponse('UNAUTHORIZED', 'Invalid or expired operator token', 401);
    }

    // propertyId comes from the verified JWT — client cannot influence it.
    const { propertyId } = payload;

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get('status') || 'SUBMITTED';

    const orders = await prisma.posOrder.findMany({
      where: {
        propertyId,
        orderType: 'ROOM_SERVICE',
        status: statusFilter as any,
      },
      include: {
        items: { include: { modifiers: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return successResponse({ orders });
  } catch (err: any) {
    console.error('[GET /api/v1/room-service/orders]', err);
    return errorResponse('INTERNAL_ERROR', err?.message || 'Failed to fetch room service orders', 500);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/room-service/orders
//
// Fix 1: Accepts a signed QR token (`t` in body) instead of raw propertyId/roomId.
//        Falls back to raw IDs only for backward compatibility with cards already
//        in the field that haven't been reprinted yet (verifies the room belongs
//        to the property as a minimum guard).
//
// Fix 6: Amenity-only orders for vacant rooms now return a clear 422 error
//        instead of silently succeeding with empty results.
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      token: qrToken,            // signed QR token — required
      outletId: requestedOutletId,
      paymentMethod = 'ROOM_CHARGE',
      notes,
      operationId,
      items = [],
      amenities = [],
    } = body;

    // ── Resolve propertyId + roomId from mandatory signed token ──────────────
    // Unsigned (plain propertyId/roomId) params are no longer accepted.
    if (!qrToken) {
      return errorResponse(
        'TOKEN_REQUIRED',
        'This QR code is outdated. Please ask the front desk for a new tent card.',
        401
      );
    }

    const verified = verifyRoomQrToken(qrToken);
    if (!verified) {
      return errorResponse(
        'INVALID_TOKEN',
        'The QR code is invalid or has been tampered with. Please ask the front desk for a new card.',
        401
      );
    }
    const propertyId = verified.propertyId;
    const roomId     = verified.roomId;


    if (!items.length && !amenities.length) {
      return errorResponse('BAD_REQUEST', 'Order must contain at least one dining item or amenity request', 400);
    }

    // 1. Idempotency Check
    if (operationId) {
      const existingOrder = await prisma.posOrder.findUnique({
        where: { operationId },
        include: {
          items: { include: { modifiers: true } },
          payments: true,
        },
      });
      if (existingOrder) {
        return successResponse({
          order: existingOrder,
          isDuplicate: true,
          message: 'Order already received',
        });
      }
    }

    // 2. Night Audit Guard
    if (await isNightAuditTransactionLocked(propertyId)) {
      return errorResponse(
        'LOCKED_BY_NIGHT_AUDIT',
        'Night audit is currently in progress. Direct ordering is temporarily paused. Please dial 0 for front desk assistance.',
        409
      );
    }

    // 3. Resolve Property & Room
    const property = await prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, name: true, timezone: true, businessDate: true },
    });
    if (!property) {
      return errorResponse('NOT_FOUND', 'Property not found', 404);
    }

    const room = await prisma.room.findFirst({
      where: { id: roomId, propertyId },
      select: { id: true, number: true, name: true },
    });
    if (!room) {
      return errorResponse('NOT_FOUND', 'Room not found', 404);
    }

    // 4. Resolve Active Checked-in Stay & Folio
    const activeStay = await prisma.reservationRoom.findFirst({
      where: {
        roomId: room.id,
        reservation: {
          propertyId,
          status: 'CHECKED_IN',
        },
      },
      select: {
        reservationId: true,
        reservation: {
          select: {
            id: true,
            primaryGuestId: true,
            primaryGuest: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            folios: {
              where: { closedAt: null },
              orderBy: { createdAt: 'asc' },
              take: 1,
              select: { id: true, folioNumber: true, balance: true },
            },
          },
        },
      },
    });

    const reservation = activeStay?.reservation ?? null;
    const isCheckedIn = !!reservation;
    const folio = reservation?.folios?.[0] ?? null;

    // ── Fix 6: Amenity-only orders with no reservation are not actionable ───
    if (items.length === 0 && amenities.length > 0 && !isCheckedIn) {
      return errorResponse(
        'RESERVATION_REQUIRED',
        'Amenity requests require an active checked-in reservation for this room. ' +
        'Please contact the front desk for assistance.',
        422
      );
    }

    // If guest chose "ROOM_CHARGE", verify folio eligibility
    if (paymentMethod === 'ROOM_CHARGE') {
      if (!isCheckedIn || !folio) {
        return errorResponse(
          'FOLIO_UNAVAILABLE',
          'Cannot charge to room: No active checked-in reservation or open folio was found for this room. Please select "Pay on Delivery".',
          422
        );
      }
    }

    // 5. Resolve Target POS Outlet
    let targetOutletId = requestedOutletId;
    if (!targetOutletId) {
      const roomServiceOutlet = await prisma.posOutlet.findFirst({
        where: { propertyId, type: 'ROOM_SERVICE', isActive: true },
        select: { id: true },
      });
      if (roomServiceOutlet) {
        targetOutletId = roomServiceOutlet.id;
      } else {
        const fallbackOutlet = await prisma.posOutlet.findFirst({
          where: { propertyId, isActive: true },
          select: { id: true },
        });
        if (!fallbackOutlet) {
          return errorResponse('OUTLET_UNAVAILABLE', 'No active POS outlet available for this property', 500);
        }
        targetOutletId = fallbackOutlet.id;
      }
    }

    // 6. Server-Authoritative Pricing & Line Items Calculation
    let calculatedSubtotal = 0;
    let calculatedTaxAmount = 0;
    const preparedOrderItems: Array<{
      productId: string | null;
      productName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      taxRate: number;
      taxAmount: number;
      total: number;
      notes: string | null;
      modifiers: Array<{ name: string; price: number }>;
    }> = [];

    if (items.length > 0) {
      const productIds = items
        .filter((i: any) => i.productId)
        .map((i: any) => i.productId);

      const dbProducts = productIds.length > 0
        ? await prisma.posProduct.findMany({
            where: { id: { in: productIds }, propertyId },
            include: { modifiers: { where: { isActive: true } } },
          })
        : [];

      const productMap = new Map(dbProducts.map(p => [p.id, p]));

      for (const item of items) {
        const dbProduct = item.productId ? productMap.get(item.productId) : null;
        if (!dbProduct) continue;

        const qty = Math.max(1, Number(item.quantity || 1));
        const baseUnitPrice = Number(dbProduct.price);
        const taxRate = Number(dbProduct.taxRate || 0);

        const selectedModifiers: Array<{ name: string; price: number }> = [];
        let modifiersExtra = 0;

        if (Array.isArray(item.modifiers)) {
          for (const reqMod of item.modifiers) {
            const dbMod = dbProduct.modifiers.find(
              m => m.id === reqMod.id || m.name.toLowerCase() === reqMod.name?.toLowerCase()
            );
            if (dbMod) {
              const modPrice = Number(dbMod.price || 0);
              modifiersExtra += modPrice;
              selectedModifiers.push({ name: dbMod.name, price: modPrice });
            }
          }
        }

        const effectiveUnitPrice = baseUnitPrice + modifiersExtra;
        const lineSubtotal = effectiveUnitPrice * qty;
        const lineTax = (lineSubtotal * taxRate) / 100;
        const lineTotal = lineSubtotal + lineTax;

        calculatedSubtotal += lineSubtotal;
        calculatedTaxAmount += lineTax;

        preparedOrderItems.push({
          productId: dbProduct.id,
          productName: dbProduct.name,
          quantity: qty,
          unitPrice: effectiveUnitPrice,
          subtotal: lineSubtotal,
          taxRate,
          taxAmount: lineTax,
          total: lineTotal,
          notes: item.notes || null,
          modifiers: selectedModifiers,
        });
      }
    }

    const calculatedTotal = calculatedSubtotal + calculatedTaxAmount;
    const effectiveBusinessDate = property.businessDate || getPropertyBusinessDate(property.timezone);

    // 7. Atomic Order Creation
    const result = await prisma.$transaction(async (tx) => {
      let createdOrder: any = null;

      if (preparedOrderItems.length > 0) {
        const count = await tx.posOrder.count({ where: { propertyId } });
        const orderNumber = `RS-${String(count + 1).padStart(5, '0')}`;

        const guestDisplayName = reservation?.primaryGuest
          ? `${reservation.primaryGuest.firstName} ${reservation.primaryGuest.lastName || ''}`.trim()
          : `Room ${room.number}`;

        createdOrder = await tx.posOrder.create({
          data: {
            propertyId,
            outletId: targetOutletId,
            sessionId: null,
            serverStaffId: null,
            tableNumber: `Room ${room.number}`,
            displayName: guestDisplayName,
            roomId: room.id,
            reservationId: reservation?.id || null,
            folioId: paymentMethod === 'ROOM_CHARGE' && folio ? folio.id : null,
            guestCount: 1,
            orderNumber,
            orderType: 'ROOM_SERVICE',
            status: 'SUBMITTED',
            paymentStatus: 'UNPAID',
            businessDate: effectiveBusinessDate,
            subtotal: calculatedSubtotal,
            taxAmount: calculatedTaxAmount,
            discount: 0,
            total: calculatedTotal,
            notes: notes ? `[Room ${room.number} Service]: ${notes}` : `[Room ${room.number} Service]`,
            operationId: operationId || `rs_op_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
            items: {
              create: preparedOrderItems.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                subtotal: item.subtotal,
                taxRate: item.taxRate,
                taxAmount: item.taxAmount,
                total: item.total,
                notes: item.notes,
                modifiers: item.modifiers.length > 0
                  ? {
                      create: item.modifiers.map((m) => ({
                        name: m.name,
                        price: m.price,
                      })),
                    }
                  : undefined,
              })),
            },
          },
          include: {
            items: { include: { modifiers: true } },
          },
        });
      }

      // 8. Create GuestServiceRequest records for amenities (requires reservation)
      const createdRequests: any[] = [];
      if (amenities.length > 0 && reservation) {
        for (const amenity of amenities) {
          const reqRecord = await tx.guestServiceRequest.create({
            data: {
              propertyId,
              reservationId: reservation.id,
              guestId: reservation.primaryGuestId,
              roomId: room.id,
              type: amenity.serviceType || 'SPECIAL_REQUEST',
              status: 'PENDING',
              description: `[In-Room QR Request]: ${amenity.name}${amenity.notes ? ` - ${amenity.notes}` : ''}`,
              charge: 0,
              details: {
                amenityId: amenity.id,
                name: amenity.name,
                roomNumber: room.number,
                linkedPosOrderId: createdOrder?.id || null,
              },
            },
          });
          createdRequests.push(reqRecord);
        }
      }

      return {
        order: createdOrder,
        serviceRequests: createdRequests,
      };
    });

    return successResponse({
      order: result.order,
      serviceRequests: result.serviceRequests,
      paymentMethod,
      roomNumber: room.number,
      message: 'Room service order placed successfully. Sent to kitchen and staff.',
    }, 201);
  } catch (err: any) {
    console.error('[POST /api/v1/room-service/orders]', err);
    return errorResponse('INTERNAL_ERROR', err?.message || 'Failed to submit room service order', 500);
  }
}
