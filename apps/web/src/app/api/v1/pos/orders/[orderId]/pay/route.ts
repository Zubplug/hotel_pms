import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';
import { requireOrganizationContext } from "@/lib/organization-access";
import { PosPaymentAccountingService } from "@/lib/services/pos-payment-accounting-service";
import { z } from 'zod';
import { InventoryService } from '@/lib/inventory/InventoryService';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';
import { GLMappingService } from '@/lib/services/gl-mapping-service';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';
import { BreakfastEntitlementService } from '@/lib/services/breakfast-entitlement-service';

const PaymentSchema = z.object({
  method: z.string(),
  amount: z.number().min(0),
  currency: z.string().default('NGN'),
  checkId: z.string().nullish(),
  reference: z.string().nullish(),
  inventoryOverrideApprovalId: z.string().uuid().nullish(),
  reservationId: z.string().uuid().nullish(),
  folioId: z.string().uuid().nullish(),
  breakfastRedemption: z.object({
    reservationId: z.string().uuid(),
    roomNumber: z.string(),
    coversRedeemed: z.number().int().min(1),
  }).nullish(),
  complimentary: z.object({
    beneficiaryType: z.enum(['GUEST', 'STAFF']),
    beneficiaryGuestId: z.string().uuid().nullish(),
    beneficiaryStaffId: z.string().uuid().nullish(),
    acknowledgedByStaffId: z.string().uuid(),
    reason: z.string().min(1),
    settlementType: z.enum(['DUTY_MANAGER', 'STAFF_PAY_LATER', 'PAY_NOW']).optional(),
  }).nullish(),
});

const managementAcknowledgementRoles = new Set([
  'CEO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'HOTEL_MANAGER',
  'MANAGER', 'FNB_MANAGER', 'RESTAURANT_MANAGER', 'BANQUET_MANAGER', 'EVENT_MANAGER',
  'FINANCE_MANAGER', 'ACCOUNTANT', 'NIGHT_AUDITOR', 'OUTLET_MANAGER',
  'DEPARTMENT_HEAD', 'HOD',
]);

// POST /api/v1/pos/orders/[orderId]/pay
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await params;
    const body = await req.json();
    
    const parsed = PaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payment data' }, { status: 400 });
    }

    const { method, amount, currency, checkId, reference, inventoryOverrideApprovalId, complimentary } = parsed.data;
    const requiresStaffPayLaterApproval = method.toUpperCase() === 'COMPLIMENTARY'
      && !parsed.data.breakfastRedemption
      && complimentary?.beneficiaryType === 'STAFF'
      && complimentary.settlementType === 'STAFF_PAY_LATER';

    // Payment posting must always be tied to an active operator session.
    let sessionId = null;
    let staffId = null;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Operator token required' }, { status: 401 });
    }
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const payload = await verifyOperatorToken(token);
      if (!payload) {
        return NextResponse.json({ error: 'Invalid operator token' }, { status: 401 });
      }
      sessionId = payload.sessionId;
      staffId = payload.staffId;
    }

    const order = await prisma.posOrder.findUnique({
      where: { id: orderId },
      include: { property: true, items: { include: { product: { include: { category: true } } } } }
    });

    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    if (method.toUpperCase() === 'COMPLIMENTARY' && amount > Number(order.total) + 0.01) {
      return NextResponse.json({ error: 'Complimentary payment cannot exceed the POS order total.' }, { status: 400 });
    }
    if (method.toUpperCase() === 'COMPLIMENTARY' && !parsed.data.breakfastRedemption && Math.abs(amount - Number(order.total)) > 0.01) {
      return NextResponse.json({ error: 'POS complimentary settlement must cover the full order total.' }, { status: 400 });
    }
    if (await isNightAuditTransactionLocked(order.propertyId, order.businessDate)) {
      return NextResponse.json({ error: 'Night audit is in progress. New POS transactions are temporarily paused.' }, { status: 409 });
    }
    if (!sessionId) {
      return NextResponse.json({ error: 'An open POS till is required before posting a payment.' }, { status: 409 });
    }
    if (order.sessionId && order.sessionId !== sessionId) {
      return NextResponse.json({ error: 'This order belongs to a different POS till.' }, { status: 403 });
    }
    const activePosSession = await prisma.posSession.findFirst({
      where: { id: sessionId, propertyId: order.propertyId, outletId: order.outletId, status: 'OPEN', controlStatus: 'OPEN' },
      select: { id: true },
    });
    if (!activePosSession) {
      return NextResponse.json({ error: 'This POS till is closed or pending approval. Open an active till to continue.' }, { status: 409 });
    }

    // 1. Idempotency Check for POS Payments
    // If a reference (idempotency key) is provided by the client, check if we already processed it
    if (reference) {
      const existingPayment = await prisma.posPayment.findFirst({
        where: { orderId, reference }
      });
      if (existingPayment) {
        // Idempotent success: return the existing state
        return NextResponse.json({ data: { payment: existingPayment, order }, error: null }, { status: 200 });
      }
    }
    
    const idKey = reference || `PAY-${orderId}-${Date.now()}`;

    const result = await prisma.$transaction(async (tx: any) => {
      // Create payment
      const payment = await tx.posPayment.create({
        data: {
          orderId,
          method: method as any,
          amount,
          currency,
          status: requiresStaffPayLaterApproval ? 'PENDING' : 'CONFIRMED',
          businessDate: order.businessDate,
          operationId: `op_pay_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          sessionId: sessionId || undefined,
          processedById: staffId || undefined,
          reference: idKey,
          ...(method.toUpperCase() === 'ROOM_CHARGE'
            ? {
                verificationStatus: 'VERIFIED',
                verifiedAt: new Date(),
                verificationNotes: 'Automatically verified: posted to an in-house guest folio as a room charge.',
              }
            : {}),
        }
      });

      if (method.toUpperCase() === 'COMPLIMENTARY' && complimentary && !parsed.data.breakfastRedemption) {
        const acknowledgement = await tx.staff.findFirst({ where: { id: complimentary.acknowledgedByStaffId, propertyAccess: { has: order.propertyId }, isActive: true }, select: { id: true, role: true } });
        if (!acknowledgement || !managementAcknowledgementRoles.has(String(acknowledgement.role || '').toUpperCase())) throw new Error('Acknowledging staff member must be active management staff for this property.');
        const beneficiaryStaff = complimentary.beneficiaryType === 'STAFF'
          ? await tx.staff.findFirst({ where: { id: complimentary.beneficiaryStaffId || '', propertyAccess: { has: order.propertyId }, isActive: true }, select: { id: true } })
          : null;
        if (complimentary.beneficiaryType === 'STAFF' && !beneficiaryStaff) throw new Error('Staff beneficiary is not active for this property.');
        const beneficiaryGuest = complimentary.beneficiaryType === 'GUEST'
          ? await tx.reservation.findFirst({ where: { propertyId: order.propertyId, primaryGuestId: complimentary.beneficiaryGuestId || '', status: 'CHECKED_IN' }, select: { id: true, primaryGuestId: true } })
          : null;
        if (complimentary.beneficiaryType === 'GUEST' && !beneficiaryGuest) throw new Error('Selected guest is not checked in at this property.');
        const beneficiaryFolio = complimentary.beneficiaryType === 'GUEST'
          ? await tx.folio.findFirst({ where: { propertyId: order.propertyId, reservationId: beneficiaryGuest?.id }, select: { id: true, guestId: true, reservationId: true, currency: true } })
          : null;
        if (complimentary.beneficiaryType === 'GUEST' && !beneficiaryFolio) throw new Error('Selected guest does not have an active folio.');
        const guest = order.folioId ? await tx.folio.findUnique({ where: { id: order.folioId }, select: { guestId: true } }) : null;
        const folioItem = beneficiaryFolio ? await tx.folioItem.create({ data: {
          folioId: beneficiaryFolio.id,
          reservationId: beneficiaryGuest?.id || beneficiaryFolio.reservationId,
          guestId: complimentary.beneficiaryGuestId,
          businessDate: order.businessDate,
          type: 'COMPLIMENTARY',
          source: 'POS',
          revenueCategory: 'FNB',
          revenueClass: 'COMPLIMENTARY_ALLOWANCE',
          description: `Audit-only complimentary allowance · POS order #${order.id}`,
          quantity: 1,
          unitAmount: amount,
          amount,
          currency: beneficiaryFolio.currency || currency,
          baseAmount: amount,
          posTransactionId: payment.id,
          postedBy: staffId || acknowledgement.id,
          operationId: `COMP_POS_FOLIO_${payment.id}`,
          originalBusinessDate: order.businessDate,
        } }) : null;
        await tx.complimentaryRecord.create({ data: {
          propertyId: order.propertyId,
          businessDate: order.businessDate,
          reference: `COMP_POS_PAYMENT_${payment.id}`,
          sourceModule: 'POS',
          folioItemId: folioItem?.id || null,
          posOrderId: order.id,
          guestId: complimentary.beneficiaryType === 'GUEST' ? beneficiaryGuest?.primaryGuestId || guest?.guestId || null : null,
          staffId: beneficiaryStaff?.id || null,
          beneficiaryType: complimentary.beneficiaryType,
          settlementType: complimentary.settlementType === 'STAFF_PAY_LATER' ? 'STAFF_PAY_LATER' : 'DUTY_MANAGER',
          acknowledgedByStaffId: acknowledgement.id,
          acknowledgedAt: new Date(),
          operatorId: staffId || undefined,
          operationId: `COMP_POS_PAYMENT_${payment.id}`,
          grossAmount: amount,
          complAmount: amount,
          netAmount: 0,
          staffLiability: complimentary.beneficiaryType === 'STAFF' && complimentary.settlementType === 'STAFF_PAY_LATER' ? amount : 0,
          complType: amount >= Number(order.total) ? 'FULL' : 'PARTIAL',
          reason: complimentary.reason,
        } });
      }

      // Update cashSales on PosSession if it's a CASH payment
      if (method === 'CASH' && sessionId) {
        await tx.posSession.update({
          where: { id: sessionId },
          data: { cashSales: { increment: amount } }
        });
      }

      // Record Breakfast Entitlement Redemption if applicable
      const isBreakfastRedemption = reference?.startsWith('BREAKFAST_ENTITLEMENT') || Boolean(parsed.data.breakfastRedemption);
      if (isBreakfastRedemption) {
        const resId = parsed.data.breakfastRedemption?.reservationId || parsed.data.reservationId || order.reservationId;
        const roomNo = parsed.data.breakfastRedemption?.roomNumber || order.tableNumber || '';
        let covers = parsed.data.breakfastRedemption?.coversRedeemed;
        if (!covers && reference?.startsWith('BREAKFAST_ENTITLEMENT:')) {
          const parts = reference.split(':');
          covers = parseInt(parts[1], 10) || 1;
        }
        covers = covers || 1;

        if (resId) {
          await BreakfastEntitlementService.recordRedemption({
            propertyId: order.propertyId,
            reservationId: resId,
            roomNumber: roomNo,
            businessDate: order.businessDate,
            coversRedeemed: covers,
            posOrderId: order.id,
            serverStaffId: staffId || undefined,
            method: 'POS_TICKET',
            operationId: `REDEEM_${resId}_${order.businessDate.toISOString().split('T')[0]}_${order.id}`,
          }, tx);
        }
      }

      // 🚨 DOUBLE-ENTRY GL POSTING FOR NON-CASH POS PAYMENTS
      // This is now securely extracted to ensure 100% offline sync parity.
      if (!requiresStaffPayLaterApproval) {
        await PosPaymentAccountingService.processPaymentAccounting(
          tx,
          payment,
          order as any, // TypeScript mapping for the included relations
          staffId || null
        );
      }

      // Check if order is fully paid
      const allOrderPayments = await tx.posPayment.aggregate({
        where: { orderId, status: 'CONFIRMED' },
        _sum: { amount: true }
      });
      const orderPaidSoFar = Number(allOrderPayments._sum.amount || 0);
      
      let updatedOrder: typeof order = order;
      if (!requiresStaffPayLaterApproval && orderPaidSoFar >= Number(order.total)) {
        await InventoryService.commitSaleInTransaction(tx, orderId, staffId || 'system', `op_sale_${orderId}_${payment.id}`, inventoryOverrideApprovalId || undefined);
        updatedOrder = await tx.posOrder.update({
          where: { id: orderId },
          data: {
            status: 'CLOSED',
            paymentStatus: 'PAID',
            closedAt: new Date(),
          }
        });

        // Release the table if applicable
        if (order.tableId) {
          await tx.posTable.update({
            where: { id: order.tableId },
            data: { currentOrderId: null }
          });
        }
      } else if (orderPaidSoFar > 0) {
        // Partially paid
        await tx.posOrder.update({
          where: { id: orderId },
          data: { paymentStatus: 'PARTIALLY_PAID' }
        });
      }

      return { payment, order: updatedOrder };
    });

    return NextResponse.json({ data: result, error: null }, { status: 201 });
  } catch (err: any) {
    console.error(`[POST /api/v1/pos/orders/[orderId]/pay]`, err);
    return NextResponse.json({ data: null, error: err.message }, { status: 500 });
  }
}
