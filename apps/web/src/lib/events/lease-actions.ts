'use server';

import { prisma } from '@hotel-pms/db';

/**
 * Triggers the billing cycle for active Lease Contracts.
 * This function would typically be called via a chron job (e.g., Night Audit or a monthly worker).
 */
export async function processLeaseBilling(propertyId: string) {
  return await prisma.$transaction(async (tx) => {
    const today = new Date();
    
    const property = await tx.property.findUnique({
      where: { id: propertyId }
    });
    
    if (!property) throw new Error("Property not found");

    // Find active schedules that are due for billing
    const dueSchedules = await tx.leaseBillingSchedule.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lte: today },
        leaseContract: {
          propertyId: propertyId,
          isActive: true
        }
      },
      include: {
        leaseContract: true
      }
    });

    const generatedInvoices = [];

    for (const schedule of dueSchedules) {
      // 1. Create the Event Invoice
      const invoice = await tx.eventInvoice.create({
        data: {
          status: 'ISSUED', 
          currency: property.baseCurrency, 
          totalAmount: schedule.amount,
          paidAmount: 0,
          items: {
            create: {
              description: `Lease payment for period ending ${schedule.dueDate.toLocaleDateString()}`,
              quantity: 1,
              unitPrice: schedule.amount,
              totalPrice: schedule.amount,
            }
          }
        }
      });

      // 2. Mark schedule as invoiced
      await tx.leaseBillingSchedule.update({
        where: { id: schedule.id },
        data: {
          status: 'INVOICED',
          invoiceId: invoice.id
        }
      });

      generatedInvoices.push(invoice);
    }

    return { processedCount: generatedInvoices.length, invoices: generatedInvoices };
  });
}
