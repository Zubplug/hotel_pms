import { prisma, Prisma } from '@hotel-pms/db';
import { TenantContext } from '../organization-access';
import { randomBytes, randomUUID } from 'crypto';

export class SupplierInvoiceService {
  /**
   * List all supplier invoices for a property with AP aging calculation.
   */
  static async list(
    ctx: TenantContext,
    propertyId: string,
    filters?: {
      status?: string;
      supplierId?: string;
      fromDate?: Date;
      toDate?: Date;
    }
  ) {
    if (!ctx.propertyIds.includes(propertyId)) {
      throw new Error(`Unauthorized access to property ${propertyId}`);
    }

    const where: Prisma.SupplierInvoiceWhereInput = {
      propertyId,
      ...(filters?.status && { status: filters.status as Prisma.EnumSupplierInvoiceStatusFilter }),
      ...(filters?.supplierId && { supplierId: filters.supplierId }),
      ...(filters?.fromDate && { dueDate: { gte: filters.fromDate } }),
      ...(filters?.toDate && { dueDate: { lte: filters.toDate } }),
    };

    const invoices = await prisma.supplierInvoice.findMany({
      where,
      include: {
        supplier: true,
        purchaseOrder: true,
        grnLinks: { include: { grn: true } },
        items: true,
        payments: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    const now = new Date();

    return invoices.map((invoice) => {
      const daysOverdue =
        invoice.status === 'PAID'
          ? 0
          : Math.floor((now.getTime() - invoice.dueDate.getTime()) / (1000 * 3600 * 24));

      let agingBucket = 'current';
      if (daysOverdue > 90) agingBucket = 'd90plus';
      else if (daysOverdue > 60) agingBucket = 'd60_90';
      else if (daysOverdue > 30) agingBucket = 'd30_60';
      else if (daysOverdue > 0) agingBucket = 'd0_30';

      return { ...invoice, agingBucket, daysOverdue };
    });
  }

  /**
   * Manual entry of a supplier invoice.
   */
  static async create(
    ctx: TenantContext,
    input: {
      propertyId: string;
      supplierId: string;
      purchaseOrderId?: string;
      invoiceNumber: string;
      invoiceDate: Date;
      dueDate: Date;
      receivedDate?: Date;
      subtotal: number;
      taxAmount?: number;
      notes?: string;
      attachmentUrl?: string;
      items?: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
        taxAmount?: number;
        grnItemId?: string;
      }>;
    }
  ) {
    if (!ctx.propertyIds.includes(input.propertyId)) {
      throw new Error(`Unauthorized access to property ${input.propertyId}`);
    }

    const taxAmount = input.taxAmount ?? 0;
    const totalAmount = input.subtotal + taxAmount;

    return prisma.$transaction(async (tx) => {
      const invoice = await tx.supplierInvoice.create({
        data: {
          propertyId: input.propertyId,
          supplierId: input.supplierId,
          purchaseOrderId: input.purchaseOrderId,
          invoiceNumber: input.invoiceNumber,
          invoiceDate: input.invoiceDate,
          dueDate: input.dueDate,
          receivedDate: input.receivedDate,
          subtotal: input.subtotal,
          taxAmount,
          totalAmount,
          outstandingAmount: totalAmount,
          notes: input.notes,
          attachmentUrl: input.attachmentUrl,
          createdBy: ctx.userId,
          status: 'RECEIVED',
          items:
            input.items && input.items.length > 0
              ? {
                  create: input.items.map((item) => ({
                    description: item.description,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.quantity * item.unitPrice,
                    taxAmount: item.taxAmount ?? 0,
                    grnItemId: item.grnItemId,
                  })),
                }
              : undefined,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: input.propertyId,
          userId: ctx.userId,
          action: 'SUPPLIER_INVOICE_CREATED',
          resource: 'SupplierInvoice',
          resourceId: invoice.id,
          requestId: randomUUID(),
          newValue: { invoiceNumber: invoice.invoiceNumber, totalAmount },
        },
      });

      return invoice;
    });
  }

  /**
   * Auto-fill invoice from a POSTED GRN.
   */
  static async createFromGRN(
    ctx: TenantContext,
    grnId: string,
    invoiceData: {
      invoiceNumber: string;
      invoiceDate: Date;
      dueDate: Date;
      taxAmount?: number;
      notes?: string;
      attachmentUrl?: string;
    }
  ) {
    const grn = await prisma.goodsReceivedNote.findUnique({
      where: { id: grnId },
      include: { items: true, purchaseOrder: true },
    });

    if (!grn) throw new Error(`GRN ${grnId} not found`);
    if (grn.status !== 'POSTED') throw new Error(`GRN ${grnId} is not POSTED`);
    if (!ctx.propertyIds.includes(grn.propertyId))
      throw new Error(`Unauthorized access to property ${grn.propertyId}`);
    if (!grn.purchaseOrder)
      throw new Error(`GRN ${grnId} must be linked to a PurchaseOrder to determine supplier`);

    const subtotal = grn.items.reduce((sum, item) => sum + Number(item.totalCost), 0);

    const invoice = await this.create(ctx, {
      propertyId: grn.propertyId,
      supplierId: grn.purchaseOrder.supplierId,
      purchaseOrderId: grn.purchaseOrder.id,
      invoiceNumber: invoiceData.invoiceNumber,
      invoiceDate: invoiceData.invoiceDate,
      dueDate: invoiceData.dueDate,
      subtotal,
      taxAmount: invoiceData.taxAmount,
      notes: invoiceData.notes,
      attachmentUrl: invoiceData.attachmentUrl,
      items: grn.items.map((item) => ({
        description: item.description || `Item from GRN ${grn.grnNumber}`,
        quantity: Number(item.receivedQty),
        unitPrice: Number(item.unitCost),
        grnItemId: item.id,
      })),
    });

    await this.linkGRN(ctx, invoice.id, grn.id, Number(invoice.totalAmount));
    return invoice;
  }

  /**
   * Link an existing GRN to an invoice.
   */
  static async linkGRN(
    ctx: TenantContext,
    invoiceId: string,
    grnId: string,
    allocatedAmount: number
  ) {
    const invoice = await prisma.supplierInvoice.findUnique({ where: { id: invoiceId } });
    const grn = await prisma.goodsReceivedNote.findUnique({ where: { id: grnId } });

    if (!invoice || !grn) throw new Error('Invoice or GRN not found');
    if (invoice.propertyId !== grn.propertyId)
      throw new Error('Invoice and GRN must belong to the same property');
    if (!ctx.propertyIds.includes(invoice.propertyId)) throw new Error('Unauthorized');

    return prisma.supplierInvoiceGRN.create({
      data: { invoiceId, grnId, allocatedAmount },
    });
  }

  /**
   * Approve a supplier invoice (RECEIVED or UNDER_REVIEW → APPROVED).
   */
  static async approve(ctx: TenantContext, invoiceId: string) {
    const invoice = await prisma.supplierInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new Error('Invoice not found');
    if (!ctx.propertyIds.includes(invoice.propertyId)) throw new Error('Unauthorized');
    if (invoice.status !== 'RECEIVED' && invoice.status !== 'UNDER_REVIEW') {
      throw new Error(`Cannot approve invoice with status ${invoice.status}`);
    }

    return prisma.$transaction(async (tx) => {
      const updated = await tx.supplierInvoice.update({
        where: { id: invoiceId },
        data: {
          status: 'APPROVED',
          approvedBy: ctx.userId,
          approvedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: invoice.propertyId,
          userId: ctx.userId,
          action: 'SUPPLIER_INVOICE_APPROVED',
          resource: 'SupplierInvoice',
          resourceId: invoice.id,
          requestId: randomUUID(),
          previousValue: { status: invoice.status },
          newValue: { status: 'APPROVED' },
        },
      });

      return updated;
    });
  }

  /**
   * Mark an invoice as DISPUTED with a reason.
   */
  static async markDisputed(ctx: TenantContext, invoiceId: string, reason: string) {
    const invoice = await prisma.supplierInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new Error('Invoice not found');
    if (!ctx.propertyIds.includes(invoice.propertyId)) throw new Error('Unauthorized');

    return prisma.$transaction(async (tx) => {
      const updated = await tx.supplierInvoice.update({
        where: { id: invoiceId },
        data: {
          status: 'DISPUTED',
          notes: invoice.notes
            ? `${invoice.notes}\nDISPUTE REASON: ${reason}`
            : `DISPUTE REASON: ${reason}`,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: invoice.propertyId,
          userId: ctx.userId,
          action: 'SUPPLIER_INVOICE_DISPUTED',
          resource: 'SupplierInvoice',
          resourceId: invoice.id,
          requestId: randomUUID(),
          newValue: { reason },
        },
      });

      return updated;
    });
  }

  /**
   * Record a payment against an APPROVED or PARTIAL invoice.
   */
  static async recordPayment(
    ctx: TenantContext,
    invoiceId: string,
    payment: {
      amount: number;
      paymentDate: Date;
      paymentMethod: string;
      bankReference?: string;
      notes?: string;
    }
  ) {
    const invoice = await prisma.supplierInvoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) throw new Error('Invoice not found');
    if (!ctx.propertyIds.includes(invoice.propertyId)) throw new Error('Unauthorized');

    if (invoice.status !== 'APPROVED' && invoice.status !== 'PARTIAL') {
      throw new Error(`Cannot pay invoice with status ${invoice.status}`);
    }
    if (payment.amount > Number(invoice.outstandingAmount)) {
      throw new Error(
        `Payment amount ${payment.amount} exceeds outstanding amount ${invoice.outstandingAmount}`
      );
    }

    const paymentReference = `PAY-${Date.now()}-${randomBytes(2).toString('hex').toUpperCase()}`;

    return prisma.$transaction(async (tx) => {
      const newOutstanding = Number(invoice.outstandingAmount) - payment.amount;
      const newPaid = Number(invoice.paidAmount) + payment.amount;
      const newStatus = newOutstanding <= 0 ? 'PAID' : 'PARTIAL';

      const supplierPayment = await tx.supplierPayment.create({
        data: {
          propertyId: invoice.propertyId,
          invoiceId: invoice.id,
          supplierId: invoice.supplierId,
          amount: payment.amount,
          paymentDate: payment.paymentDate,
          paymentMethod: payment.paymentMethod,
          bankReference: payment.bankReference,
          paymentReference,
          notes: payment.notes,
          paidBy: ctx.userId,
        },
      });

      const updatedInvoice = await tx.supplierInvoice.update({
        where: { id: invoiceId },
        data: {
          outstandingAmount: newOutstanding,
          paidAmount: newPaid,
          status: newStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: ctx.organizationId,
          propertyId: invoice.propertyId,
          userId: ctx.userId,
          action: 'SUPPLIER_PAYMENT_RECORDED',
          resource: 'SupplierPayment',
          resourceId: supplierPayment.id,
          requestId: randomUUID(),
          newValue: { invoiceId, amount: payment.amount, newStatus },
        },
      });

      return updatedInvoice;
    });
  }
}
