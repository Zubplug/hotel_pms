import { GLMappingService } from './gl-mapping-service';
import { GeneralLedgerService } from './general-ledger-service';

export class CityLedgerAccountingService {
  /**
   * Applies existing unapplied corporate receipts to a newly-created city
   * ledger invoice. This is intentionally transaction-scoped so lease/event
   * invoice issuance cannot leave an invoice open when the account already
   * has available advance credit.
   */
  static async applyAvailableCorporateAdvance(
    tx: any,
    input: {
      propertyId: string;
      organizationId: string;
      staffId: string;
      accountId: string;
      invoiceId: string;
      amount: number;
      currency: string;
      businessDate: Date;
      eventInvoiceId?: string | null;
    },
  ) {
    if (input.amount <= 0.01) return 0;

    const account = await tx.cityLedgerAccount.findUnique({
      where: { id: input.accountId },
      select: { type: true, currency: true },
    });
    if (!account || account.type !== 'CORPORATE') return 0;

    const openPayments = await tx.cityLedgerEntry.findMany({
      where: {
        accountId: input.accountId,
        type: 'PAYMENT',
        status: 'OPEN',
        currency: input.currency,
      },
      include: { allocations: true },
      orderBy: { createdAt: 'asc' },
    });

    let remaining = input.amount;
    let appliedTotal = 0;
    for (const payment of openPayments) {
      if (remaining <= 0.01) break;
      const allocated = payment.allocations.reduce(
        (sum: number, allocation: any) => sum + Number(allocation.amount),
        0,
      );
      const available = Number(payment.amount) - allocated;
      if (available <= 0.01) {
        await tx.cityLedgerEntry.update({
          where: { id: payment.id },
          data: { status: 'SETTLED' },
        });
        continue;
      }

      const applied = Math.min(available, remaining);
      await tx.cityLedgerAllocation.create({
        data: {
          paymentId: payment.id,
          invoiceId: input.invoiceId,
          amount: applied,
          currency: input.currency,
          createdBy: input.staffId,
        },
      });

      if (available - applied <= 0.01) {
        await tx.cityLedgerEntry.update({
          where: { id: payment.id },
          data: { status: 'SETTLED' },
        });
      }
      remaining -= applied;
      appliedTotal += applied;
    }

    if (appliedTotal <= 0.01) return 0;

    const invoice = await tx.cityLedgerInvoice.update({
      where: { id: input.invoiceId },
      data: {
        paidAmount: { increment: appliedTotal },
        outstandingAmount: { decrement: appliedTotal },
        status: remaining <= 0.01 ? 'PAID' : 'PARTIALLY_PAID',
      },
    });

    if (remaining <= 0.01) {
      await tx.cityLedgerEntry.updateMany({
        where: {
          invoiceId: input.invoiceId,
          type: 'TRANSFER_IN',
          status: 'OPEN',
        },
        data: { status: 'SETTLED' },
      });
    }

    if (input.eventInvoiceId) {
      const eventInvoice = await tx.eventInvoice.findUnique({
        where: { id: input.eventInvoiceId },
        select: { id: true, totalAmount: true, paidAmount: true },
      });
      if (eventInvoice) {
        const paidAmount = Number(eventInvoice.paidAmount) + appliedTotal;
        const paid = paidAmount + 0.01 >= Number(eventInvoice.totalAmount);
        await tx.eventInvoice.update({
          where: { id: eventInvoice.id },
          data: { paidAmount, status: paid ? 'PAID' : 'PARTIAL' },
        });
        if (paid) {
          await tx.leaseBillingSchedule.updateMany({
            where: { invoiceId: eventInvoice.id },
            data: { status: 'PAID' },
          });
        }
      }
    }

    await tx.cityLedgerAccount.update({
      where: { id: input.accountId },
      data: { balance: { decrement: appliedTotal } },
    });

    const property = await tx.property.findUnique({
      where: { id: input.propertyId },
      select: { organizationId: true },
    });
    if (!property) throw new Error('PROPERTY_NOT_FOUND');
    await GeneralLedgerService.postJournal(
      {
        userId: input.staffId,
        propertyIds: [input.propertyId],
        organizationId: input.organizationId || property.organizationId,
        role: 'SYSTEM',
        permissions: [],
        outletIds: [],
      },
      {
        propertyId: input.propertyId,
        entryDate: input.businessDate,
        reference: `CITY-LEDGER-ADVANCE-APPLICATION-${input.invoiceId}`,
        description: `Apply corporate advance to city ledger invoice ${invoice.invoiceNumber}`,
        sourceModule: 'AR',
        lines: [
          {
            accountId: await GLMappingService.getCorporateAdvancesAccount(input.propertyId),
            debit: appliedTotal,
            credit: 0,
            description: 'Reduce corporate advance liability',
            sourceType: 'CITY_LEDGER_ADVANCE_APPLICATION',
            sourceId: input.invoiceId,
          },
          {
            accountId: await GLMappingService.getCityLedgerAccount(input.propertyId),
            debit: 0,
            credit: appliedTotal,
            description: 'Reduce city ledger receivable',
            sourceType: 'CITY_LEDGER_ADVANCE_APPLICATION',
            sourceId: input.invoiceId,
          },
        ],
      },
      tx,
    );

    return appliedTotal;
  }

  static async settleGuestRefund(
    tx: any,
    input: { propertyId: string; organizationId: string; staffId: string; cityLedgerEntryId: string; refundRequestId: string; amount: number; method: string; businessDate: Date },
  ) {
    const entry = await tx.cityLedgerEntry.findUnique({ where: { id: input.cityLedgerEntryId }, include: { allocations: true } });
    const isCorporateAdvance = entry?.type === 'PAYMENT';
    if (!entry || !['REFUND_OWED', 'PAYMENT'].includes(entry.type) || entry.status === 'SETTLED') throw new Error('GUEST_CREDIT_NOT_AVAILABLE');
    if (entry.type === 'PAYMENT') {
      const account = await tx.cityLedgerAccount.findUnique({ where: { id: entry.accountId }, select: { type: true } });
      if (account?.type !== 'CORPORATE') throw new Error('GUEST_CREDIT_NOT_AVAILABLE');
    }
    const allocated = entry.allocations.reduce((sum: number, allocation: any) => sum + Number(allocation.amount), 0);
    const available = Number(entry.amount) - allocated;
    if (input.amount <= 0 || input.amount > available + 0.01) throw new Error('GUEST_CREDIT_AMOUNT_EXCEEDED');

    const liabilityAccountId = isCorporateAdvance
      ? await GLMappingService.getCorporateAdvancesAccount(input.propertyId)
      : await GLMappingService.getGuestRefundsPayableAccount(input.propertyId);
    const tenderMethod = input.method === 'ORIGINAL_PAYMENT' ? 'POS' : input.method;
    const tenderAccountId = await GLMappingService.getAssetAccountForMethod(input.propertyId, tenderMethod);
    const systemCtx = { userId: input.staffId, propertyIds: [input.propertyId], organizationId: input.organizationId, role: 'SYSTEM', permissions: [], outletIds: [] };
    await GeneralLedgerService.postJournal(systemCtx, {
      propertyId: input.propertyId,
      entryDate: input.businessDate,
      reference: `GUEST-CREDIT-REFUND-${input.refundRequestId}`,
      description: `${isCorporateAdvance ? 'Settle corporate advance refund' : 'Settle guest credit refund'} for city-ledger entry ${input.cityLedgerEntryId}`,
      sourceModule: 'AR',
      lines: [
        { accountId: liabilityAccountId, debit: input.amount, credit: 0, description: isCorporateAdvance ? 'Reduce Corporate Advances' : 'Reduce Guest Refunds Payable', sourceType: isCorporateAdvance ? 'CORPORATE_ADVANCE_REFUND' : 'GUEST_CREDIT_REFUND', sourceId: input.cityLedgerEntryId },
        { accountId: tenderAccountId, debit: 0, credit: input.amount, description: `Refund paid by ${tenderMethod}`, sourceType: 'GUEST_CREDIT_REFUND', sourceId: input.cityLedgerEntryId },
      ],
    }, tx);

    await tx.cityLedgerAllocation.create({ data: { paymentId: input.cityLedgerEntryId, amount: input.amount, currency: entry.currency, createdBy: input.staffId } });
    if (!isCorporateAdvance) await tx.cityLedgerAccount.update({ where: { id: entry.accountId }, data: { balance: { decrement: input.amount } } });
    if (available - input.amount <= 0.01) await tx.cityLedgerEntry.update({ where: { id: entry.id }, data: { status: 'SETTLED', reason: `Guest credit refunded; request ${input.refundRequestId}` } });
  }

  /**
   * Processes the double-entry accounting journal for routing a Folio balance
   * to the City Ledger. This is explicitly extracted to guarantee offline sync
   * and online checkout auto-routing share the exact same accounting construction logic.
   */
  static async processCityLedgerRouting(
    tx: any,
    propertyId: string,
    organizationId: string | null,
    staffId: string | null,
    amount: number,
    folioId: string,
    invoiceNumber: string | null, // Reference for the AR Invoice
    idempotencyKey: string, // Crucial for deduplication
    businessDate: Date
  ) {
    if (Math.abs(amount) <= 0.01) {
      return;
    }

    let cityLedgerAssetAccountId: string;
    let guestLedgerAccountId: string;

    // 1. Resolve Asset GL Accounts
    try {
      cityLedgerAssetAccountId = amount < 0
        ? await GLMappingService.getGuestRefundsPayableAccount(propertyId)
        : await GLMappingService.getAssetAccountForMethod(propertyId, 'CITY_LEDGER');
      guestLedgerAccountId = await GLMappingService.getGuestLedgerAccount(propertyId);
    } catch (e: any) {
      // Differentiate missing GL configuration from other errors for offline sync
      if (e.message?.includes('Missing') || e.message?.includes('mapping required') || e.message?.includes('is missing')) {
        throw new Error(`RETRYABLE_ACCOUNTING_CONFIG: Accounting Configuration Required: ${e.message}`);
      }
      throw e;
    }

    // 2. Post Double-Entry Journal
    const systemCtx = {
      userId: staffId || 'system',
      propertyIds: [propertyId],
      organizationId: organizationId || '',
      role: 'SYSTEM',
      permissions: [],
      outletIds: []
    };

    const isDebit = amount > 0;
    
    // If amount > 0, the guest owes money, and we move it to Corporate (City Ledger increases, Guest Ledger decreases).
    // If amount < 0, the guest overpaid, and we move credit to Corporate (City Ledger decreases, Guest Ledger increases).
    
    const lines = [
      {
        accountId: cityLedgerAssetAccountId,
        debit: isDebit ? Math.abs(amount) : 0,
        credit: isDebit ? 0 : Math.abs(amount),
        description: `City Ledger Transfer for Folio ${folioId}`,
        sourceType: 'CITY_LEDGER_TRANSFER',
        sourceId: folioId,
      },
      {
        accountId: guestLedgerAccountId,
        debit: isDebit ? 0 : Math.abs(amount),
        credit: isDebit ? Math.abs(amount) : 0,
        description: `Relieve Guest Ledger for Folio ${folioId}`,
        sourceType: 'CITY_LEDGER_TRANSFER',
        sourceId: folioId,
      }
    ];

    await GeneralLedgerService.postJournal(
      systemCtx,
      {
        propertyId,
        entryDate: businessDate,
        reference: invoiceNumber || idempotencyKey, // Idempotency
        description: `Auto-routed outstanding balance to City Ledger (Folio ${folioId})`,
        sourceModule: 'AR',
        lines
      },
      tx // Explicitly pass the shared transaction
    );
  }
}
