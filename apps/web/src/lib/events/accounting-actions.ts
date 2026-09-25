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
  return await prisma.$transaction(async (tx) => {
    const invoice = await tx.eventInvoice.findFirst({
      where: { id: invoiceId, event: { propertyId } },
      include: { items: true, event: true }
    });

    if (!invoice) throw new Error("Invoice not found.");
    if (!['DRAFT', 'UNPAID'].includes(invoice.status)) throw new Error('Only draft or unpaid invoices can be finalized.');

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
      const existingLedgerInvoice = await tx.cityLedgerInvoice.findFirst({ where: { invoiceNumber: `INV-${invoice.id.substring(0, 8)}` } });
      if (!existingLedgerInvoice) await tx.cityLedgerInvoice.create({
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
          createdBy: userId
        }
      });
    }

    revalidatePath(`/fnb/events/accounting`);
    return updatedInvoice;
  });
}
