import prisma from "@hotel-pms/db";
import { randomUUID } from "crypto";
import { FolioItemSource, PaymentMethod } from "@hotel-pms/db";

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
            operationId: `folio_chg_${operationId}`
          }
        });
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

      // 5. Update Order Status
      // If payment covers total, mark as PAID
      const allPayments = await tx.posPayment.findMany({
        where: { orderId: order.id, status: 'CONFIRMED' }
      });
      const totalPaid = allPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0) + params.amount;

      const isFullyPaid = totalPaid >= Number(order.total);
      
      await tx.posOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus: isFullyPaid ? 'PAID' : 'PARTIAL',
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
