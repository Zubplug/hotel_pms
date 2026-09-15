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
        issueDate: new Date()
      }
    });

    // If there is an outstanding amount and it's linked to a City Ledger Account, create an entry
    if (invoice.outstandingAmount.toNumber() > 0 && invoice.cityLedgerAccountId) {
      await tx.cityLedgerInvoice.create({
        data: {
          propertyId: invoice.propertyId,
          accountId: invoice.cityLedgerAccountId,
          invoiceNumber: invoice.invoiceNumber,
          issueDate: new Date(),
          dueDate: invoice.dueDate,
          description: `Event Billing for ${invoice.event?.name || 'Event'}`,
          amount: invoice.totalAmount,
          outstandingAmount: invoice.outstandingAmount,
          paidAmount: invoice.paidAmount,
        }
      });
    }

    // In a fully integrated PMS, we would also generate JournalEntries here linking the revenue 
    // to the correct Chart of Accounts based on the EventInvoiceItems.
    // Example (pseudo-logic for JournalEntry):
    /*
      await tx.journalEntry.create({
        data: {
          propertyId: invoice.propertyId,
          accountingPeriodId: currentPeriodId,
          entryDate: new Date(),
          reference: invoice.invoiceNumber,
          description: `Revenue posting for Event ${invoice.event?.name}`,
          status: 'POSTED',
          lines: {
            create: invoice.items.map(item => ({
              accountId: determineRevenueAccount(item.type),
              credit: item.total,
              debit: 0
            })).concat({
              accountId: AR_ACCOUNT_ID,
              credit: 0,
              debit: invoice.totalAmount
            })
          }
        }
      });
    */

    revalidatePath(`/fnb/events/accounting`);
    return updatedInvoice;
  });
}
