import { Payment } from '@hotel-pms/db';
import { GLMappingService } from './gl-mapping-service';
import { GeneralLedgerService } from './general-ledger-service';

export class FolioPaymentAccountingService {
  /**
   * Processes the double-entry accounting journal for a Folio Payment.
   * This is explicitly extracted to guarantee offline sync and online Folio Payment flows
   * share the exact same byte-for-byte accounting construction logic.
   */
  static async processPaymentAccounting(
    tx: any,
    payment: Payment,
    propertyId: string,
    organizationId: string | null,
    staffId: string | null
  ) {
    // 🚨 Real-time Cash Recognition: Cash payments are now journaled in real-time
    // to accurately reflect revenue at the exact moment of sale (Dr 1000 Cash / Cr Guest Ledger).
    // The subsequent Cash Handover only performs a custody transfer (Dr 1000 Safe / Cr 1000 Drawer).

    let debitGlAccountId: string;
    let creditGlAccountId: string;

    const amount = Number(payment.amount);

    // 1. Resolve Asset and Revenue GL Accounts
    try {
      debitGlAccountId = await GLMappingService.getAssetAccountForMethod(propertyId, payment.method);
      creditGlAccountId = await GLMappingService.getGuestLedgerAccount(propertyId);
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

    const lines = [
      {
        accountId: debitGlAccountId,
        debit: amount,
        credit: 0,
        description: `Payment Collection via ${payment.method}`,
        sourceType: 'PAYMENT',
        sourceId: payment.id,
      },
      {
        accountId: creditGlAccountId,
        debit: 0,
        credit: amount,
        description: `Relieve Guest Ledger for Folio ${payment.folioId}`,
        sourceType: 'PAYMENT',
        sourceId: payment.id,
      }
    ];

    await GeneralLedgerService.postJournal(
      systemCtx,
      {
        propertyId,
        entryDate: payment.businessDate || new Date(),
        reference: payment.reference || payment.receiptNumber || payment.id,
        description: `Folio Payment Settlement - ${payment.method}`,
        sourceModule: 'AR',
        lines
      },
      tx // Explicitly pass the shared transaction
    );
  }
}
