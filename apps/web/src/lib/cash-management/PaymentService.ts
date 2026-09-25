import prisma from "@hotel-pms/db";
import { randomUUID } from "crypto";
import { FolioItemSource, PaymentMethod } from "@hotel-pms/db";
import { applyAvailableFolioCredit } from "@/lib/finance/apply-folio-credit";
import { applyAvailableGuestLedgerCredit } from "@/lib/finance/apply-guest-ledger-credit";

export class PaymentService {
  /**
   * Settles a POS Order. If method is ROOM_CHARGE, it transactionally verifies the folio
   * and creates a FolioCharge.
   */
  static async settleOrder(params: {
    orderId: string;
    method: PaymentMethod;
    amount: number;
    cashierId: string;
    sessionId?: string;
    folioId?: string;
    idempotencyKey?: string;
  }) {
    const operationId = params.idempotencyKey || `settle_${params.orderId}_${Date.now()}`;

    return await prisma.$transaction(async (tx: any) => {
      // 1. Idempotency Check
      const existingPayment = await tx.posPayment.findFirst({
        where: { operationId }
      });
      if (existingPayment) {
        return { success: true, payment: existingPayment, message: 'Already settled' };
      }

      // 2. Fetch Order
      const order = await tx.posOrder.findUnique({
        where: { id: params.orderId }
      });
      if (!order) throw new Error('Order not found');
      if (order.status === 'CLOSED' || order.paymentStatus === 'PAID') {
        throw new Error('Order is already paid or closed');
      }

      const propertyId = order.propertyId;

      // 3. Room Charge Validation
      if (params.method === 'ROOM_CHARGE') {
        if (!params.folioId) throw new Error('Folio ID required for Room Charge');

        const folio = await tx.folio.findUnique({
          where: { id: params.folioId },
          include: { items: true, credits: true, reservation: true }
        });

        if (!folio) throw new Error('Folio not found');
        if (folio.status === 'CLOSED') throw new Error('Folio is closed');

        if (folio.corporateAccountId) {
          const corporateAccount = await tx.corporateAccount.findUnique({
            where: { id: folio.corporateAccountId },
            select: { propertyId: true, isActive: true, creditLimit: true, exemptFromHighBalance: true },
          });
          if (!corporateAccount || corporateAccount.propertyId !== propertyId || !corporateAccount.isActive) {
            throw new Error('Corporate account is inactive or unavailable for this property');
          }
          if (Number(corporateAccount.creditLimit) > 0 && !corporateAccount.exemptFromHighBalance && Number(folio.balance) + params.amount > Number(corporateAccount.creditLimit)) {
            throw new Error('CREDIT_LIMIT_EXCEEDED: POS charge exceeds the corporate account credit limit');
          }
        }
        
        // Validation: Guest in-house (Reservation status CHECKED_IN)
        if (folio.reservation && folio.reservation.status !== 'CHECKED_IN') {
          throw new Error('Guest is not currently in-house');
        }

        // Apply Charge to Folio
        await tx.folioItem.create({
          data: {
            folioId: folio.id,
            businessDate: order.businessDate,
            type: 'CHARGE',
            source: 'POS' as FolioItemSource,
            description: `POS Room Charge - Order #${order.orderNumber}`,
            quantity: 1,
            unitAmount: params.amount,
            amount: params.amount,
            currency: 'NGN',
            baseAmount: params.amount,
            posTransactionId: order.id,
            postedBy: params.cashierId,
            operationId: `folio_chg_${operationId}`,
            reservationId: order.reservationId || folio.reservationId,
            guestId: folio.guestId,
          }
        });

        await tx.folio.update({
          where: { id: folio.id },
          data: {
            totalCharges: { increment: params.amount },
            balance: { increment: params.amount },
          },
        });

        // Apply credit in the same order as Night Audit and offline Front
        // Desk: current-folio credit first, then previous-stay City Ledger
        // credit. The allocation helpers are idempotent and write the payment,
        // ledger allocation, audit trail, and GL entry in this transaction.
        const property = await tx.property.findUnique({
          where: { id: propertyId },
          select: { organizationId: true, businessDate: true, timezone: true },
        });
        const guestId = folio.guestId;
        const reservationId = folio.reservationId || order.reservationId;
        const currency = folio.currency || 'NGN';
        const businessDate = property?.businessDate || new Date();
        const sameFolioApplied = await applyAvailableFolioCredit(tx, {
          folioId: folio.id,
          propertyId,
          guestId,
          reservationId,
          amount: params.amount,
          currency,
          source: 'POS',
          description: `Applied folio credit to POS charge - Order #${order.orderNumber}`,
          appliedBy: params.cashierId,
          operationKey: `POS_CREDIT:${operationId}`,
          businessDate,
        });

        if (property?.organizationId && guestId && reservationId) {
          await applyAvailableGuestLedgerCredit(tx, {
            folioId: folio.id,
            propertyId,
            organizationId: property.organizationId,
            guestId,
            reservationId,
            amount: Math.max(0, params.amount - sameFolioApplied),
            currency,
            appliedBy: params.cashierId,
            operationKey: `POS_CREDIT:${operationId}`,
            businessDate,
            description: `Applied previous-stay guest credit to POS charge - Order #${order.orderNumber}`,
          });
        }
      }

      // 4. Create Payment Ledger Record (PosPayment acts as the ledger)
      const payment = await tx.posPayment.create({
        data: {
          id: randomUUID(),
          orderId: order.id,
          amount: params.amount,
          method: params.method,
          currency: 'NGN',
          status: 'CONFIRMED',
          sessionId: params.sessionId || null,
          processedById: params.cashierId,
          businessDate: order.businessDate,
          paidAt: new Date(),
          operationId
        }
      });

      // Update cashSales on PosSession if it's a CASH payment
      if (params.method === 'CASH' && params.sessionId) {
        await tx.posSession.update({
          where: { id: params.sessionId },
          data: { cashSales: { increment: params.amount } }
        });
      }

      // 5. Update Order Status
      // If payment covers total, mark as PAID
      const allPayments = await tx.posPayment.findMany({
        where: { orderId: order.id, status: 'CONFIRMED' }
      });
      // The newly-created payment is already included in this query. Do not
      // add params.amount a second time, or a partial payment can be marked
      // fully paid prematurely.
      const totalPaid = allPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

      const isFullyPaid = totalPaid >= Number(order.total);
      
      await tx.posOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus: isFullyPaid ? 'PAID' : 'PARTIALLY_PAID',
          folioId: params.method === 'ROOM_CHARGE' ? params.folioId : order.folioId,
          // Optional: we can auto-close if fully paid
          status: isFullyPaid ? 'CLOSED' : order.status,
          updatedAt: new Date()
        }
      });

      return { success: true, payment };
    });
  }
}
