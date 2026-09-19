import { GLMappingService } from './gl-mapping-service';
import { GeneralLedgerService } from './general-ledger-service';

export class CityLedgerAccountingService {
  static async settleGuestRefund(
    tx: any,
    input: { propertyId: string; organizationId: string; staffId: string; cityLedgerEntryId: string; refundRequestId: string; amount: number; method: string; businessDate: Date },
  ) {
    const entry = await tx.cityLedgerEntry.findUnique({ where: { id: input.cityLedgerEntryId }, include: { allocations: true } });
    if (!entry || entry.type !== 'REFUND_OWED' || entry.status === 'SETTLED') throw new Error('GUEST_CREDIT_NOT_AVAILABLE');
    const allocated = entry.allocations.reduce((sum: number, allocation: any) => sum + Number(allocation.amount), 0);
    const available = Number(entry.amount) - allocated;
    if (input.amount <= 0 || input.amount > available + 0.01) throw new Error('GUEST_CREDIT_AMOUNT_EXCEEDED');

    const liabilityAccountId = await GLMappingService.getGuestRefundsPayableAccount(input.propertyId);
    const tenderMethod = input.method === 'ORIGINAL_PAYMENT' ? 'POS' : input.method;
    const tenderAccountId = await GLMappingService.getAssetAccountForMethod(input.propertyId, tenderMethod);
    const systemCtx = { userId: input.staffId, propertyIds: [input.propertyId], organizationId: input.organizationId, role: 'SYSTEM', permissions: [], outletIds: [] };
    await GeneralLedgerService.postJournal(systemCtx, {
      propertyId: input.propertyId,
      entryDate: input.businessDate,
      reference: `GUEST-CREDIT-REFUND-${input.refundRequestId}`,
      description: `Settle guest credit refund for city-ledger entry ${input.cityLedgerEntryId}`,
      sourceModule: 'AR',
      lines: [
        { accountId: liabilityAccountId, debit: input.amount, credit: 0, description: 'Reduce Guest Refunds Payable', sourceType: 'GUEST_CREDIT_REFUND', sourceId: input.cityLedgerEntryId },
        { accountId: tenderAccountId, debit: 0, credit: input.amount, description: `Refund paid by ${tenderMethod}`, sourceType: 'GUEST_CREDIT_REFUND', sourceId: input.cityLedgerEntryId },
      ],
    }, tx);

    await tx.cityLedgerAllocation.create({ data: { paymentId: input.cityLedgerEntryId, amount: input.amount, currency: entry.currency, createdBy: input.staffId } });
    await tx.cityLedgerAccount.update({ where: { id: entry.accountId }, data: { balance: { decrement: input.amount } } });
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
