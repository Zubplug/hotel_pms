import prisma, { PurchaseOrderStatus } from '@hotel-pms/db';

export class ProcurementService {
  /**
   * Submit a PO for approval.
   */
  static async submitPO(poId: string, actorId: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new Error('Purchase Order not found');
    if (po.status !== 'DRAFT') throw new Error('Only DRAFT POs can be submitted');

    return await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: 'SUBMITTED',
        updatedBy: actorId,
        updatedAt: new Date(),
      }
    });
  }

  /**
   * Approve a PO. 
   * Note: Permissions should be validated in the API route before calling this.
   */
  static async approvePO(poId: string, actorId: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new Error('Purchase Order not found');
    if (po.status !== 'SUBMITTED') throw new Error('Only SUBMITTED POs can be approved');

    return await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: 'APPROVED',
        updatedBy: actorId,
        updatedAt: new Date(),
      }
    });
  }

  /**
   * Reject a PO.
   */
  static async rejectPO(poId: string, actorId: string, reason: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new Error('Purchase Order not found');
    if (po.status !== 'SUBMITTED') throw new Error('Only SUBMITTED POs can be rejected');

    return await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: PurchaseOrderStatus.REJECTED,
        rejectedBy: actorId,
        rejectedAt: new Date(),
        rejectedReason: reason,
        updatedBy: actorId,
        updatedAt: new Date(),
      }
    });
  }

  /**
   * Cancel an approved PO.
   */
  static async cancelPO(poId: string, actorId: string) {
    const po = await prisma.purchaseOrder.findUnique({ where: { id: poId } });
    if (!po) throw new Error('Purchase Order not found');
    if (po.status !== 'APPROVED') throw new Error('Only APPROVED POs can be cancelled');

    return await prisma.purchaseOrder.update({
      where: { id: poId },
      data: {
        status: PurchaseOrderStatus.CANCELLED,
        cancelledBy: actorId,
        cancelledAt: new Date(),
        updatedBy: actorId,
        updatedAt: new Date(),
      }
    });
  }

  /**
   * Generate a DRAFT GRN from an Approved PO.
   * Items provided should be the quantities physically received.
   */
  static async createGRN(
    poId: string, 
    actorId: string, 
    items: { poItemId: string, receivedQty: number, unitCost: number }[],
    deliveryNoteRef?: string
  ) {
    return await prisma.$transaction(async (tx: any) => {
      const po = await tx.purchaseOrder.findUnique({
        where: { id: poId },
        include: { items: true }
      });

      if (!po) throw new Error('Purchase Order not found');
      if (po.status !== 'APPROVED' && po.status !== 'PARTIALLY_RECEIVED') {
        throw new Error('PO must be APPROVED or PARTIALLY_RECEIVED to create a GRN');
      }

      const validItems = [];
      for (const input of items) {
        if (Number(input.receivedQty) <= 0) continue; // Skip zero/negative quantities

        const poItem = po.items.find((i: any) => i.id === input.poItemId);
        if (!poItem) throw new Error(`PO Item ${input.poItemId} not found on this PO`);
        if (!poItem.stockItemId) throw new Error(`PO Item ${input.poItemId} is missing a stockItemId`);
        
        const remainingQty = Number(poItem.quantity) - Number(poItem.receivedQty);
        if (Number(input.receivedQty) > remainingQty) {
          throw new Error(`Cannot receive ${input.receivedQty} for ${poItem.description}. Only ${remainingQty} remaining.`);
        }

        validItems.push({
          stockItemId: poItem.stockItemId,
          description: poItem.description,
          receivedQty: input.receivedQty,
          unitOfMeasure: poItem.unitOfMeasure,
          unitCost: input.unitCost,
        });
      }

      if (validItems.length === 0) {
        throw new Error('Cannot create an empty GRN. No valid received quantities provided.');
      }
      const grnCount = await tx.goodsReceivedNote.count({ where: { propertyId: po.propertyId } });
      const grnNumber = `GRN-${String(grnCount + 1).padStart(5, '0')}`;

      const grn = await tx.goodsReceivedNote.create({
        data: {
          propertyId: po.propertyId,
          purchaseOrderId: po.id,
          grnNumber,
          status: 'DRAFT',
          deliveryNoteRef,
          receivedDate: new Date(),
          createdBy: actorId,
          items: {
            create: validItems
          }
        },
        include: { items: true }
      });

      return { success: true, grn };
    });
  }
}
