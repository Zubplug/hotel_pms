'use server';

import { prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireEventContext } from './access';

/**
 * Finalizes an Event Invoice, optionally posting to the General Ledger (JournalEntry) 
 * and routing the balance to the City Ledger or a Folio.
 */
export async function finalizeEventInvoice(invoiceId: string, _postedById?: string) {
  const { propertyId, userId } = await requireEventContext();
  const actualPostedBy = userId;

  return await prisma.$transaction(async (tx) => {
    const invoice = await tx.eventInvoice.findFirst({
      where: { id: invoiceId, event: { propertyId } },
      include: { items: true, event: true }
    });

    if (!invoice) throw new Error("Invoice not found.");
    if (['ISSUED', 'PARTIAL', 'PAID'].includes(invoice.status)) return invoice;
    if (!['DRAFT', 'UNPAID'].includes(invoice.status)) throw new Error('Only draft or unpaid invoices can be finalized.');

    // Idempotent Check: Check if we have already posted this invoice
    // For Corporate, check CityLedgerInvoice
    // For Individual, check FolioItem
    let existingCityLedgerInvoice = null;
    let existingFolioItem = null;

    if (invoice.cityLedgerAccountId) {
       existingCityLedgerInvoice = await tx.cityLedgerInvoice.findFirst({
         where: { propertyId, invoiceNumber: `INV-${invoice.id.substring(0, 8)}` }
       });
    } else if (invoice.folioId) {
       existingFolioItem = await tx.folioItem.findFirst({
         where: { folioId: invoice.folioId, operationId: `EVENT-INV-${invoice.id}` }
       });
    }

    // Update Invoice Status
    const updatedInvoice = await tx.eventInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'ISSUED',
      }
    });

    const outstandingAmount = invoice.totalAmount.toNumber() - invoice.paidAmount.toNumber();

    if (outstandingAmount > 0) {
      if (invoice.cityLedgerAccountId && invoice.event?.propertyId) {
        if (!existingCityLedgerInvoice) {
          await tx.cityLedgerInvoice.create({
            data: {
              propertyId: invoice.event.propertyId,
              accountId: invoice.cityLedgerAccountId,
              invoiceNumber: `INV-${invoice.id.substring(0,8)}`,
              issueDate: new Date(),
              dueDate: new Date(), // Due on receipt
              description: `Event Billing for ${invoice.event?.name || 'Event'}`,
              amount: invoice.totalAmount,
              outstandingAmount: outstandingAmount,
              paidAmount: invoice.paidAmount,
              currency: invoice.currency,
              createdBy: actualPostedBy
            }
          });
        }
      } else if (invoice.folioId && invoice.event?.propertyId) {
        if (!existingFolioItem) {
          await tx.folioItem.create({
            data: {
              folioId: invoice.folioId,
              guestId: invoice.event.guestId,
              businessDate: new Date(),
              type: 'CHARGE',
              source: 'OTHER',
              revenueCategory: 'FNB', // Or appropriate category
              description: `Event Billing for ${invoice.event?.name || 'Event'}`,
              quantity: 1,
              unitAmount: invoice.totalAmount,
              amount: invoice.totalAmount,
              currency: invoice.currency,
              baseAmount: invoice.totalAmount,
              postedBy: actualPostedBy,
              operationId: `EVENT-INV-${invoice.id}` // Idempotency key
            }
          });
          await tx.folio.update({
            where: { id: invoice.folioId },
            data: {
              totalCharges: { increment: invoice.totalAmount },
              balance: { increment: invoice.totalAmount },
              version: { increment: 1 },
            },
          });
        }
      }
    }

    revalidatePath(`/fnb/events/accounting`);
    revalidatePath(`/fnb/events/accounting/${invoiceId}`);
    return updatedInvoice;
  });
}
