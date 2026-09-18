type Tx = any;
import { CityLedgerAccountingService } from '@/lib/services/city-ledger-accounting-service';

type CheckoutFolio = {
  id: string;
  balance: number | string;
  version: number;
  currency?: string | null;
};

type RouteInput = {
  tx: Tx;
  folios: CheckoutFolio[];
  reservationId: string;
  guestId?: string;
  propertyId: string;
  corporateAccountId?: string;
  targetAccountId?: string;
  guestName?: string;
  guestPhone?: string;
  confirmationNumber: string;
  createdBy: string;
  keepFolioOpen?: boolean;
};

/**
 * Moves the net folio balances to the corporate city ledger at checkout.
 * A positive folio balance is an AR debit; a negative balance is a guest
 * credit and is recorded as a city-ledger payment/credit.
 */
export async function routeFoliosToCityLedger(input: RouteInput) {
  const { tx, folios, reservationId, propertyId, corporateAccountId, targetAccountId, guestName, guestPhone, confirmationNumber, createdBy } = input;
  
  let accountId = targetAccountId;
  
  if (!accountId && corporateAccountId) {
    const corporateAccount = await tx.corporateAccount.findUnique({
      where: { id: corporateAccountId },
      select: { cityLedgerAccountId: true },
    });
    accountId = corporateAccount?.cityLedgerAccountId;
  }

  if (!accountId) throw new Error('PAYMENT_REQUIRED');
  let transferredDebit = 0;
  let transferredCredit = 0;

  for (const folio of folios) {
    const amount = Number(folio.balance);
    if (Math.abs(amount) <= 0.01) continue;

    const currency = folio.currency || 'NGN';
    if (amount > 0) {
      const issueDate = new Date();
      issueDate.setUTCHours(0, 0, 0, 0);
      const dueDate = new Date(issueDate);
      dueDate.setUTCDate(dueDate.getUTCDate() + 30);
      const invoiceNumber = `AR-${confirmationNumber}-${String(folio.id).slice(0, 8).toUpperCase()}`;
      const description = guestName 
        ? `Walk-out/Skipper folio ${folio.id} for reservation ${confirmationNumber} (Guest: ${guestName}${guestPhone ? ` - ${guestPhone}` : ''})`
        : `Corporate folio ${folio.id} for reservation ${confirmationNumber}`;

      const invoice = await tx.cityLedgerInvoice.create({
        data: {
          propertyId,
          accountId,
          invoiceNumber,
          issueDate,
          dueDate,
          description,
          amount,
          outstandingAmount: amount,
          currency,
          createdBy,
        },
      });

      let remainingInvoiceBalance = amount;
      
      const openPayments = await tx.cityLedgerEntry.findMany({
        where: { accountId, type: 'PAYMENT', status: 'OPEN' },
        include: { allocations: true },
        orderBy: { createdAt: 'asc' } // Chronological FIFO
      });
      
      for (const payment of openPayments) {
        if (remainingInvoiceBalance <= 0) break;
        
        const alreadyAllocated = payment.allocations.reduce((sum: number, alloc: any) => sum + Number(alloc.amount), 0);
        const availableCredit = Number(payment.amount) - alreadyAllocated;
        
        if (availableCredit <= 0) {
          await tx.cityLedgerEntry.update({ where: { id: payment.id }, data: { status: 'SETTLED' } });
          continue;
        }
        
        const applyAmount = Math.min(availableCredit, remainingInvoiceBalance);
        
        await tx.cityLedgerAllocation.create({
          data: {
            paymentId: payment.id,
            invoiceId: invoice.id,
            amount: applyAmount,
            currency,
            createdBy,
          }
        });
        
        remainingInvoiceBalance -= applyAmount;
        
        if (availableCredit - applyAmount <= 0.01) {
          await tx.cityLedgerEntry.update({ where: { id: payment.id }, data: { status: 'SETTLED' } });
        }
      }
      
      if (remainingInvoiceBalance < amount) {
        await tx.cityLedgerInvoice.update({
          where: { id: invoice.id },
          data: {
            paidAmount: amount - remainingInvoiceBalance,
            outstandingAmount: remainingInvoiceBalance,
            status: remainingInvoiceBalance <= 0.01 ? 'PAID' : 'PARTIALLY_PAID'
          }
        });
      }

      await tx.cityLedgerEntry.create({
        data: {
          accountId,
          propertyId,
          guestId: input.guestId,
          reservationId,
          folioId: folio.id,
          amount,
          currency,
          type: 'TRANSFER_IN',
          status: remainingInvoiceBalance <= 0.01 ? 'SETTLED' : 'OPEN',
          reason: 'Auto-routed outstanding balance to City Ledger upon checkout',
          reference: invoiceNumber,
          invoiceId: invoice.id,
          createdBy,
        },
      });
      await tx.cityLedgerAccount.update({ where: { id: accountId }, data: { balance: { increment: amount } } });
      transferredDebit += amount;
    } else {
      const credit = Math.abs(amount);
      await tx.cityLedgerEntry.create({
        data: {
          accountId,
          propertyId,
          guestId: input.guestId,
          reservationId,
          folioId: folio.id,
          amount: credit,
          currency,
          type: 'REFUND_OWED',
          status: 'OPEN',
          reason: 'Auto-routed guest credit to City Ledger upon checkout',
          reference: `CR-${confirmationNumber}-${String(folio.id).slice(0, 8).toUpperCase()}`,
          createdBy,
        },
      });
      await tx.cityLedgerAccount.update({ where: { id: accountId }, data: { balance: { decrement: credit } } });
      transferredCredit += credit;
    }

    // 🚨 DOUBLE-ENTRY GL POSTING FOR CITY LEDGER TRANSFER
    // This correctly routes Guest Ledger (1100) to City Ledger (1140).
    // The service handles both positive (debit) and negative (credit) transfers.
    // Fetch property to get organizationId
    const property = await tx.property.findUnique({
      where: { id: propertyId },
      select: { organizationId: true }
    });
    const invoiceNumber = amount > 0 ? `AR-${confirmationNumber}-${String(folio.id).slice(0, 8).toUpperCase()}` : `CR-${confirmationNumber}-${String(folio.id).slice(0, 8).toUpperCase()}`;
    await CityLedgerAccountingService.processCityLedgerRouting(
      tx,
      propertyId,
      property?.organizationId || null,
      createdBy,
      amount,
      folio.id,
      invoiceNumber,
      `cl_route_${folio.id}_${confirmationNumber}`
    );

    await tx.folioItem.create({
      data: {
        folioId: folio.id,
        businessDate: new Date(),
        type: 'PAYMENT',
        source: 'CITY_LEDGER',
        description: amount > 0 ? 'City Ledger transfer at checkout' : 'City Ledger credit at checkout',
        quantity: 1,
        unitAmount: -amount,
        amount: -amount,
        currency,
        baseAmount: -amount,
        postedBy: createdBy,
        reservationId: input.reservationId,
        guestId: input.guestId,
      },
    });
    await tx.folio.update({
      where: { id: folio.id },
      data: input.keepFolioOpen
        ? { balance: { decrement: amount }, totalPayments: { increment: Math.abs(amount) } }
        : { balance: 0, totalPayments: { increment: Math.abs(amount) } },
    });
  }

  return { transferredDebit, transferredCredit };
}
