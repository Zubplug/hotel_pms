'use server';

import { prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';

/**
 * Finalizes an Event Invoice, optionally posting to the General Ledger (JournalEntry) 
 * and routing the balance to the City Ledger or a Folio.
 */
export async function finalizeEventInvoice(invoiceId: string, postedById: string) {
  return await prisma.$transaction(async (tx) => {
    const invoice = await tx.eventInvoice.findUnique({
      where: { id: invoiceId },
      include: { items: true, event: true }
    });

    if (!invoice) throw new Error("Invoice not found.");
    if (invoice.status !== 'DRAFT') throw new Error("Only DRAFT invoices can be finalized.");

    // Update Invoice Status
    const updatedInvoice = await tx.eventInvoice.update({
      where: { id: invoiceId },
      data: {
        status: 'ISSUED',
      }
    });

    const outstandingAmount = invoice.totalAmount.toNumber() - invoice.paidAmount.toNumber();

    // If there is an outstanding amount and it's linked to a City Ledger Account, create an entry
    if (outstandingAmount > 0 && invoice.cityLedgerAccountId && invoice.event?.propertyId) {
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
          createdBy: postedById
        }
      });
    }

    revalidatePath(`/fnb/events/accounting`);
    return updatedInvoice;
  });
}
