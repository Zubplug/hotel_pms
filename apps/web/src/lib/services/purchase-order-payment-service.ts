import prisma from '@hotel-pms/db';
import { TenantContext } from '../organization-access';
import { randomBytes, randomUUID } from 'crypto';

export class PurchaseOrderPaymentService {
  /**
   * Record an advance payment against an APPROVED purchase order.
   */
  static async recordAdvancePayment(
    ctx: TenantContext,
    purchaseOrderId: string,
    payment: {
      amount: number;
      paymentDate: Date;
      paymentMethod: string;
      bankReference?: string;
      notes?: string;
    }
  ) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: purchaseOrderId } });
    if (!po) throw new Error('Purchase Order not found');
    if (!ctx.propertyIds.includes(po.propertyId)) throw new Error('Unauthorized');

    if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
      throw new Error(`Cannot pay purchase order with status ${po.status}. Must be APPROVED.`);
    }

    // Determine outstanding based on total amount and paid amount
    const outstanding = Number(po.totalAmount) - Number(po.paidAmount);
    
    // We allow overpaying slightly if needed, but normally cap it at totalAmount.
    // For simplicity, we just warn or block if it exceeds the expected PO total.
    if (payment.amount > outstanding && outstanding > 0) {
      throw new Error(`Payment amount ${payment.amount} exceeds the remaining PO balance of ${outstanding}`);
    }

    const paymentReference = `ADV-${Date.now()}-${randomBytes(2).toString('hex').toUpperCase()}`;

    return prisma.$transaction(async (tx) => {
      const newPaidAmount = Number(po.paidAmount) + payment.amount;
      const newPaymentStatus = newPaidAmount >= Number(po.totalAmount) ? 'PAID' : 'PARTIAL';

      const supplierPayment = await tx.supplierPayment.create({
        data: {
          propertyId: po.propertyId,
          supplierId: po.supplierId,
          purchaseOrderId: po.id,
          amount: payment.amount,
          paymentDate: payment.paymentDate,
          paymentMethod: payment.paymentMethod,
          bankReference: payment.bankReference,
          paymentReference,
          notes: payment.notes || 'Advance Payment against PO',
          paidBy: ctx.userId,
        },
      });

      const updatedPO = await tx.purchaseOrder.update({
        where: { id: purchaseOrderId },
        data: {
          paidAmount: newPaidAmount,
          paymentStatus: newPaymentStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: po.propertyId,
          userId: ctx.userId,
          action: 'PO_ADVANCE_PAYMENT_RECORDED',
          resource: 'PurchaseOrder',
          resourceId: po.id,
          requestId: randomUUID(),
          newValue: { purchaseOrderId, amount: payment.amount, newPaymentStatus },
        },
      });

      return updatedPO;
    });
  }
}
