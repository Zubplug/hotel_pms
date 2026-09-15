'use server';

import { prisma } from '@hotel-pms/db';

/**
 * Triggers the billing cycle for active Lease Contracts.
 * This function would typically be called via a chron job (e.g., Night Audit or a monthly worker).
 */
export async function processLeaseBilling(propertyId: string) {
  return await prisma.$transaction(async (tx) => {
    const today = new Date();
    
    // Find active schedules that are due for billing
    const dueSchedules = await tx.leaseBillingSchedule.findMany({
      where: {
        status: 'PENDING',
        dueDate: { lte: today },
        contract: {
          propertyId: propertyId,
          status: 'ACTIVE'
        }
      },
      include: {
        contract: true
      }
    });

    const generatedInvoices = [];

    for (const schedule of dueSchedules) {
      // 1. Create the Event Invoice
      const invoice = await tx.eventInvoice.create({
        data: {
          propertyId,
          invoiceNumber: `LEASE-${schedule.contract.id.substring(0, 5).toUpperCase()}-${schedule.dueDate.toISOString().substring(0, 10)}`,
          type: 'FINAL', // It's a definitive recurring charge
          status: 'ISSUED', // Issued immediately
          issueDate: new Date(),
          dueDate: schedule.dueDate,
          currency: 'NGN', // Assuming NGN or fetch from property config
          totalAmount: schedule.amount,
          paidAmount: 0,
          outstandingAmount: schedule.amount,
          items: {
            create: {
              description: `Lease payment for period ending ${schedule.dueDate.toLocaleDateString()}`,
              quantity: 1,
              unitPrice: schedule.amount,
              total: schedule.amount,
              isTaxable: true // Depends on jurisdiction, simplified here
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

      // 3. Post to City Ledger if the contract defines a corporate account
      // This bridges the recurring lease system back to standard hotel AR
      if (schedule.contract.tenantId) {
        // Look up the CityLedgerAccount associated with the Tenant (CorporateAccount)
        // Note: We need a link between tenant and city ledger. 
        // For simplicity, we assume there is an AR posting process handled downstream by finalizeEventInvoice.
      }

      generatedInvoices.push(invoice);
    }

    return { processedCount: generatedInvoices.length, invoices: generatedInvoices };
  });
}
