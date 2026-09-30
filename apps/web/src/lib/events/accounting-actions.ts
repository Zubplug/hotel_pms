'use server';

import { prisma } from '@hotel-pms/db';
import type { Prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireEventRole } from './access';
import { getPropertyBusinessDate } from '@/lib/date-utils';
import { CityLedgerAccountingService } from '@/lib/services/city-ledger-accounting-service';
import { postEventInvoiceRevenue } from './event-revenue-accounting';

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
    where: { id: invoiceId, OR: [{ event: { propertyId } }, { propertyId }] },
    include: { items: true, event: true, leaseBillingSchedule: { include: { leaseContract: true } } },
  });
  if (!invoice) throw new Error('Event invoice not found.');
  return invoice;
}

function recognitionDate(invoice: { event?: { startDate: Date } | null; leaseBillingSchedule?: { periodStart: Date; dueDate: Date } | null }, timezone: string, fallback: Date) {
  if (invoice.leaseBillingSchedule) return invoice.leaseBillingSchedule.dueDate;
  if (invoice.event?.startDate) return getPropertyBusinessDate(timezone, invoice.event.startDate);
  return fallback;
}

export async function reviewEventInvoice(invoiceId: string, input: { approve: boolean; discountAmount?: number; discountReason?: string; lineDiscounts?: Record<string, number>; lineReasons?: Record<string, string> }) {
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
    const requestedByLine = new Map(invoice.items.map((item) => [item.id, Number(item.requestedDiscount || 0)]));
    const requestedTotal = invoice.items.reduce((sum, item) => sum + (requestedByLine.get(item.id) || 0), 0);
    const legacyTotal = Number(input.discountAmount ?? invoice.requestedDiscount);
    if (!Number.isFinite(legacyTotal) || legacyTotal < 0 || legacyTotal > grossTotal) throw new Error('Discount must be between zero and the invoice gross amount.');
    const explicitLineTotal = input.lineDiscounts
      ? Object.values(input.lineDiscounts).reduce((sum, amount) => sum + Number(amount || 0), 0)
      : null;
    const discount = explicitLineTotal == null ? legacyTotal : explicitLineTotal;
    if (!Number.isFinite(discount) || discount < 0 || discount > grossTotal) throw new Error('Approved discounts must be between zero and the invoice gross amount.');
    const tax = await tx.tax.findFirst({
      where: { propertyId, isActive: true, OR: [{ code: 'VAT' }, { name: { contains: 'VAT', mode: 'insensitive' } }] },
      orderBy: { createdAt: 'asc' },
    });
    const taxableSubtotal = Math.max(0, grossTotal - discount);
    const taxRate = tax?.type === 'PERCENTAGE' ? Number(tax.rate) / 100 : 0;
    const taxAmount = tax?.type === 'FLAT' ? Math.max(0, Number(tax.rate)) : taxableSubtotal * taxRate;

    for (const item of invoice.items) {
      const gross = Number(item.grossAmount || item.totalPrice);
      const requestedLineDiscount = requestedByLine.get(item.id) || 0;
      const lineDiscount = input.lineDiscounts
        ? Number(input.lineDiscounts[item.id] || 0)
        : requestedTotal > 0
          ? legacyTotal * (requestedLineDiscount / requestedTotal)
          : grossTotal ? legacyTotal * (gross / grossTotal) : 0;
      if (!Number.isFinite(lineDiscount) || lineDiscount < 0 || lineDiscount > gross) throw new Error(`Discount for ${item.description} is invalid.`);
      const lineTax = taxableSubtotal ? taxAmount * ((gross - lineDiscount) / taxableSubtotal) : 0;
      await tx.eventInvoiceItem.update({
        where: { id: item.id },
        data: {
          discountAmount: lineDiscount,
          requestedDiscount: requestedLineDiscount,
          taxAmount: lineTax,
          totalPrice: gross - lineDiscount + lineTax,
          taxId: tax?.id ?? null,
          discountReason: input.lineReasons?.[item.id]?.trim() || input.discountReason?.trim() || null,
          discountApprovedBy: userId,
          discountApprovedAt: new Date(),
          discountStatus: 'APPROVED',
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

/** Issues an approved invoice and posts the receivable; revenue is recognized on service date. */
export async function issueEventInvoice(invoiceId: string) {
  const { propertyId, userId } = await requireEventRole('CASHIER');
  const result = await prisma.$transaction(async (tx) => {
    const invoice = await scopedInvoice(tx, invoiceId, propertyId);
    if (['ISSUED', 'PARTIAL', 'PAID'].includes(invoice.status) || invoice.workflowStatus === 'ISSUED') return invoice;
    if (invoice.workflowStatus !== 'APPROVED') throw new Error('The invoice must be approved by accounting before it can be issued.');
    if (!['DRAFT', 'UNPAID'].includes(invoice.status)) throw new Error('This invoice cannot be issued in its current financial status.');

    const operationId = `EVENT-INV-${invoice.id}`;
    const outstandingAmount = Number(invoice.totalAmount) - Number(invoice.paidAmount);
    const property = await tx.property.findUnique({ where: { id: propertyId }, select: { organizationId: true, businessDate: true, timezone: true } });
    if (!property) throw new Error('Property not found.');
    const businessDate = property.businessDate || getPropertyBusinessDate(property.timezone);
    const revenueDate = recognitionDate(invoice, property.timezone, businessDate);
    const lines = invoice.items.map((item) => ({
      item,
      gross: Number(item.grossAmount || item.totalPrice),
      discount: Number(item.discountAmount || 0),
      tax: Number(item.taxAmount || 0),
      category: String(item.category || 'OTHER').toUpperCase(),
    }));

    if (outstandingAmount > 0 && invoice.cityLedgerAccountId && (invoice.event?.propertyId === propertyId || invoice.propertyId === propertyId)) {
      const accountId = invoice.cityLedgerAccountId;
      const invoiceNumber = `INV-${invoice.id.substring(0, 8)}`;
      const existing = await tx.cityLedgerInvoice.findFirst({ where: { eventInvoiceId: invoice.id } });
      let cityInvoice = existing;
      if (!existing) {
        cityInvoice = await tx.cityLedgerInvoice.create({ data: { propertyId, accountId, eventInvoiceId: invoice.id, invoiceNumber, issueDate: businessDate, dueDate: businessDate, description: `Event Billing for ${invoice.event?.name || invoice.leaseBillingSchedule?.leaseContract?.contactName || 'Hall Lease'}`, amount: invoice.totalAmount, outstandingAmount, paidAmount: invoice.paidAmount, currency: invoice.currency, createdBy: userId } });
        await tx.cityLedgerEntry.create({ data: { accountId, propertyId, amount: outstandingAmount, currency: invoice.currency, type: 'TRANSFER_IN', status: 'OPEN', reference: invoiceNumber, reason: `Event invoice ${invoice.id}`, invoiceId: cityInvoice.id, createdBy: userId } });
        await tx.cityLedgerAccount.update({ where: { id: accountId }, data: { balance: { increment: outstandingAmount } } });
      }
      if (cityInvoice && Number(cityInvoice.outstandingAmount) > 0.01) {
        await CityLedgerAccountingService.applyAvailableCorporateAdvance(tx, {
          propertyId,
          organizationId: property.organizationId,
          staffId: userId,
          accountId,
          invoiceId: cityInvoice.id,
          amount: Number(cityInvoice.outstandingAmount),
          currency: cityInvoice.currency,
          businessDate,
          eventInvoiceId: invoice.id,
        });
      }
      if (revenueDate.getTime() <= businessDate.getTime()) {
        await postEventInvoiceRevenue(tx, { propertyId, organizationId: property.organizationId, userId, entryDate: revenueDate, invoice });
      }
    } else if (outstandingAmount > 0 && invoice.folioId && invoice.event?.propertyId) {
      if (!invoice.event.guestId) throw new Error('Individual event invoice is missing its guest.');
      const folioId = invoice.folioId;
      const guestId = invoice.event.guestId;
      const existing = await tx.folioItem.findFirst({ where: { folioId: invoice.folioId, operationId: `${operationId}-CHARGE-${invoice.items[0]?.id || 'TOTAL'}` } });
      if (!existing) {
        for (const line of lines) {
          const base = { folioId, guestId, businessDate: revenueDate, source: 'OTHER' as const, revenueCategory: line.category === 'FOOD' ? 'FNB' as const : 'OTHER' as const, revenueClass: line.category, currency: invoice.currency, postedBy: userId };
          if (line.gross > 0) await tx.folioItem.create({ data: { ...base, type: 'CHARGE', description: line.item.description, quantity: line.item.quantity, unitAmount: line.gross, amount: line.gross, baseAmount: line.gross, operationId: `${operationId}-CHARGE-${line.item.id}` } });
          if (line.tax > 0) await tx.folioItem.create({ data: { ...base, type: 'TAX', description: `${line.item.description} tax`, quantity: 1, unitAmount: line.tax, amount: line.tax, baseAmount: line.tax, operationId: `${operationId}-TAX-${line.item.id}` } });
          if (line.discount > 0) await tx.folioItem.create({ data: { ...base, type: 'DISCOUNT', description: `${line.item.description} discount`, quantity: 1, unitAmount: -line.discount, amount: -line.discount, baseAmount: -line.discount, operationId: `${operationId}-DISCOUNT-${line.item.id}` } });
        }
        const gross = lines.reduce((sum, line) => sum + line.gross, 0);
        const tax = lines.reduce((sum, line) => sum + line.tax, 0);
        const discount = lines.reduce((sum, line) => sum + line.discount, 0);
        await tx.folio.update({ where: { id: folioId }, data: { totalCharges: { increment: gross + tax - discount }, balance: { increment: outstandingAmount }, version: { increment: 1 } } });
      }
    }
    const issued = await tx.eventInvoice.update({ where: { id: invoice.id }, data: { status: 'ISSUED', workflowStatus: 'ISSUED', issuedBy: userId, issuedAt: new Date(), version: { increment: 1 } } });
    await auditTransition(tx, propertyId, userId, invoice.id, 'EVENT_INVOICE_ISSUED', { status: invoice.status, workflowStatus: invoice.workflowStatus }, { status: 'ISSUED', workflowStatus: 'ISSUED' });
    return issued;
  }, { timeout: 30000 });
  revalidatePath('/fnb/events/accounting');
  revalidatePath(`/fnb/events/accounting/${invoiceId}`);
  return result;
}

// Backwards-compatible name for existing callers; issuance is now role-gated and approval-gated.
export async function finalizeEventInvoice(invoiceId: string) {
  return issueEventInvoice(invoiceId);
}
