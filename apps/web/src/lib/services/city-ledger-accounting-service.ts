import { GLMappingService } from './gl-mapping-service';
import { GeneralLedgerService } from './general-ledger-service';

export class CityLedgerAccountingService {
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
