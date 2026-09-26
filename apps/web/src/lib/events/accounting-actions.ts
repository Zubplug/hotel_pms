'use server';

import { prisma } from '@hotel-pms/db';
import type { Prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireEventRole } from './access';

type Tx = Prisma.TransactionClient;

async function auditTransition(
  tx: Tx,
  propertyId: string,
  userId: string,
  invoiceId: string,
  action: string,
  previousValue: unknown,
  newValue: unknown,
) {
  const property = await tx.property.findUnique({ where: { id: propertyId }, select: { organizationId: true } });
  if (!property) throw new Error('Property not found.');
  await tx.auditLog.create({
    data: {
      organizationId: property.organizationId,
      propertyId,
      userId,
      action,
      resource: 'EventInvoice',
      resourceId: invoiceId,
      previousValue: JSON.parse(JSON.stringify(previousValue)),
      newValue: JSON.parse(JSON.stringify(newValue)),
      requestId: crypto.randomUUID(),
    },
  });
}

async function scopedInvoice(tx: Tx, invoiceId: string, propertyId: string) {
  const invoice = await tx.eventInvoice.findFirst({
    where: { id: invoiceId, event: { propertyId } },
    include: { items: true, event: true },
  });
  if (!invoice) throw new Error('Event invoice not found.');
  return invoice;
}

export async function submitEventInvoiceForReview(invoiceId: string) {
  const { propertyId, userId } = await requireEventRole('FNB');
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await scopedInvoice(tx, invoiceId, propertyId);
    if (!['DRAFT', 'REJECTED'].includes(invoice.workflowStatus)) {
      throw new Error('Only a draft or rejected invoice can be submitted for review.');
    }
    const updated = await tx.eventInvoice.update({
      where: { id: invoice.id },
      data: {
        workflowStatus: 'SUBMITTED',
        submittedBy: userId,
        submittedAt: new Date(),
        rejectionReason: null,
        rejectedBy: null,
        rejectedAt: null,
        version: { increment: 1 },
      },
    });
    await auditTransition(tx, propertyId, userId, invoice.id, 'EVENT_INVOICE_SUBMITTED', { workflowStatus: invoice.workflowStatus }, { workflowStatus: 'SUBMITTED' });
    return updated;
  });
  revalidatePath('/fnb/events/accounting');
  revalidatePath(`/fnb/events/accounting/${invoiceId}`);
  return result;
}

export async function reviewEventInvoice(invoiceId: string, input: { approve: boolean; discountAmount?: number; discountReason?: string }) {
  const { propertyId, userId } = await requireEventRole('ACCOUNTING');
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await scopedInvoice(tx, invoiceId, propertyId);
    if (!['SUBMITTED', 'IN_REVIEW'].includes(invoice.workflowStatus)) {
      throw new Error('Only submitted event invoices can be reviewed.');
    }
    if (invoice.submittedBy === userId) {
      throw new Error('The booking submitter cannot approve the same event invoice.');
    }
    if (!input.approve) {
      const reason = input.discountReason?.trim();
      if (!reason) throw new Error('A rejection reason is required.');
      const rejected = await tx.eventInvoice.update({
        where: { id: invoice.id },
        data: { workflowStatus: 'REJECTED', rejectedBy: userId, rejectedAt: new Date(), rejectionReason: reason, reviewedBy: userId, reviewedAt: new Date(), version: { increment: 1 } },
      });
      await auditTransition(tx, propertyId, userId, invoice.id, 'EVENT_INVOICE_REJECTED', { workflowStatus: invoice.workflowStatus }, { workflowStatus: 'REJECTED', reason });
      return rejected;
    }

    const grossTotal = invoice.items.reduce((sum, item) => sum + Number(item.grossAmount || item.totalPrice), 0);
    const discount = Number(input.discountAmount ?? invoice.requestedDiscount);
    if (!Number.isFinite(discount) || discount < 0 || discount > grossTotal) throw new Error('Discount must be between zero and the invoice gross amount.');
    const tax = await tx.tax.findFirst({
      where: { propertyId, isActive: true, OR: [{ code: 'VAT' }, { name: { contains: 'VAT', mode: 'insensitive' } }] },
      orderBy: { createdAt: 'asc' },
    });
    const taxableSubtotal = Math.max(0, grossTotal - discount);
    const taxRate = tax?.type === 'PERCENTAGE' ? Number(tax.rate) / 100 : 0;
    const taxAmount = tax?.type === 'FLAT' ? Math.max(0, Number(tax.rate)) : taxableSubtotal * taxRate;

    for (const item of invoice.items) {
      const gross = Number(item.grossAmount || item.totalPrice);
      const lineDiscount = grossTotal ? discount * (gross / grossTotal) : 0;
      const lineTax = taxableSubtotal ? taxAmount * ((gross - lineDiscount) / taxableSubtotal) : 0;
      await tx.eventInvoiceItem.update({
        where: { id: item.id },
        data: {
          discountAmount: lineDiscount,
          taxAmount: lineTax,
          totalPrice: gross - lineDiscount + lineTax,
          taxId: tax?.id ?? null,
        },
      });
    }
    const approved = await tx.eventInvoice.update({
      where: { id: invoice.id },
      data: {
        subTotal: taxableSubtotal,
        totalDiscount: discount,
        totalTax: taxAmount,
        totalAmount: taxableSubtotal + taxAmount,
        requestedDiscount: discount,
        discountReason: input.discountReason?.trim() || null,
        workflowStatus: 'APPROVED',
        reviewedBy: userId,
        reviewedAt: new Date(),
        approvedBy: userId,
        approvedAt: new Date(),
        version: { increment: 1 },
      },
    });
    await auditTransition(tx, propertyId, userId, invoice.id, 'EVENT_INVOICE_APPROVED', { workflowStatus: invoice.workflowStatus, totalAmount: Number(invoice.totalAmount), totalDiscount: Number(invoice.totalDiscount) }, { workflowStatus: 'APPROVED', totalAmount: taxableSubtotal + taxAmount, totalDiscount: discount, discountReason: input.discountReason?.trim() || null });
    return approved;
  });
  revalidatePath('/fnb/events/accounting');
  revalidatePath(`/fnb/events/accounting/${invoiceId}`);
  return result;
}

/** Issues an approved invoice and posts exactly one folio/city-ledger charge. */
export async function issueEventInvoice(invoiceId: string) {
  const { propertyId, userId } = await requireEventRole('CASHIER');
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await scopedInvoice(tx, invoiceId, propertyId);
    if (['ISSUED', 'PARTIAL', 'PAID'].includes(invoice.status) || invoice.workflowStatus === 'ISSUED') return invoice;
    if (invoice.workflowStatus !== 'APPROVED') throw new Error('The invoice must be approved by accounting before it can be issued.');
    if (!['DRAFT', 'UNPAID'].includes(invoice.status)) throw new Error('This invoice cannot be issued in its current financial status.');

    const operationId = `EVENT-INV-${invoice.id}`;
    const outstandingAmount = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    if (outstandingAmount > 0 && invoice.cityLedgerAccountId && invoice.event?.propertyId) {
      const accountId = invoice.cityLedgerAccountId;
      const invoiceNumber = `INV-${invoice.id.substring(0, 8)}`;
      const existing = await tx.cityLedgerInvoice.findFirst({ where: { propertyId, invoiceNumber } });
      if (!existing) {
        await tx.cityLedgerInvoice.create({
          data: { propertyId, accountId, invoiceNumber, issueDate: new Date(), dueDate: new Date(), description: `Event Billing for ${invoice.event.name || 'Event'}`, amount: invoice.totalAmount, outstandingAmount, paidAmount: invoice.paidAmount, currency: invoice.currency, createdBy: userId },
        });
      }
    } else if (outstandingAmount > 0 && invoice.folioId && invoice.event?.propertyId) {
      if (!invoice.event.guestId) throw new Error('Individual event invoice is missing its guest.');
      const folioId = invoice.folioId;
      const guestId = invoice.event.guestId;
      const existing = await tx.folioItem.findFirst({ where: { folioId: invoice.folioId, operationId } });
      if (!existing) {
        await tx.folioItem.create({ data: { folioId, guestId, businessDate: new Date(), type: 'CHARGE', source: 'OTHER', revenueCategory: 'FNB', description: `Event Billing for ${invoice.event.name || 'Event'}`, quantity: 1, unitAmount: invoice.totalAmount, amount: invoice.totalAmount, currency: invoice.currency, baseAmount: invoice.totalAmount, postedBy: userId, operationId } });
        await tx.folio.update({ where: { id: folioId }, data: { totalCharges: { increment: invoice.totalAmount }, balance: { increment: invoice.totalAmount }, version: { increment: 1 } } });
      }
    }
    const issued = await tx.eventInvoice.update({ where: { id: invoice.id }, data: { status: 'ISSUED', workflowStatus: 'ISSUED', issuedBy: userId, issuedAt: new Date(), version: { increment: 1 } } });
    await auditTransition(tx, propertyId, userId, invoice.id, 'EVENT_INVOICE_ISSUED', { status: invoice.status, workflowStatus: invoice.workflowStatus }, { status: 'ISSUED', workflowStatus: 'ISSUED' });
    return issued;
  });
  revalidatePath('/fnb/events/accounting');
  revalidatePath(`/fnb/events/accounting/${invoiceId}`);
  return result;
}

// Backwards-compatible name for existing callers; issuance is now role-gated and approval-gated.
export async function finalizeEventInvoice(invoiceId: string) {
  return issueEventInvoice(invoiceId);
}
