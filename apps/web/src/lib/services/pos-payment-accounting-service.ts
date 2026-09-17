import { PosPayment, PosOrder, PosOrderItem, PosProduct, ProductCategory } from '@hotel-pms/db';
import { GLMappingService } from './gl-mapping-service';
import { GeneralLedgerService } from './general-ledger-service';

export class PosPaymentAccountingService {
  /**
   * Processes the double-entry accounting journal for a POS Payment.
   * This is explicitly extracted to guarantee offline sync and online POS flows
   * share the exact same byte-for-byte accounting construction logic.
   */
  static async processPaymentAccounting(
    tx: any,
    payment: PosPayment,
    order: PosOrder & {
      items: (PosOrderItem & { product: (PosProduct & { category: ProductCategory | null }) | null })[],
      property: { organizationId: string | null }
    },
    staffId: string | null
  ) {
    // 🚨 Real-time Cash Recognition: Cash payments are now journaled in real-time
    // to accurately reflect revenue at the exact moment of sale (Dr 1000 Cash / Cr F&B Revenue).
    // The subsequent Cash Handover only performs a custody transfer (Dr 1000 Safe / Cr 1000 Drawer).

    let orderTotalFromItems = 0;
    const classTotals = new Map<string, number>();

    // 1. Group items by FnbClass
    for (const item of order.items) {
      const fnbClass = item.product?.category?.fnbClass || 'OTHER';
      const itemTotal = Number(item.quantity) * Number(item.unitPrice);
      classTotals.set(fnbClass, (classTotals.get(fnbClass) || 0) + itemTotal);
      orderTotalFromItems += itemTotal;
    }

    const amount = Number(payment.amount);

    // Fallback if order total is 0 to avoid division by zero
    if (orderTotalFromItems === 0) {
      orderTotalFromItems = amount;
      classTotals.set('OTHER', amount);
    }

    let debitGlAccountId: string;
    const revenueCreditLines: Array<{ accountId: string; credit: number; fnbClass: string }> = [];

    // 2. Resolve Asset and Revenue GL Accounts
    try {
      debitGlAccountId = await GLMappingService.getAssetAccountForMethod(order.propertyId, payment.method);

      for (const [fnbClass, classTotal] of classTotals.entries()) {
        const accountId = await GLMappingService.getPosRevenueAccount(order.propertyId, fnbClass);
        const proportion = classTotal / orderTotalFromItems;
        const classCreditAmount = Math.round(amount * proportion * 100) / 100;
        
        if (classCreditAmount > 0) {
          revenueCreditLines.push({ accountId, credit: classCreditAmount, fnbClass });
        }
      }
    } catch (e: any) {
      // Differentiate missing GL configuration from other errors for offline sync
      if (e.message?.includes('Missing') || e.message?.includes('mapping required') || e.message?.includes('is missing')) {
        throw new Error(`RETRYABLE_ACCOUNTING_CONFIG: Accounting Configuration Required: ${e.message}`);
      }
      throw e;
    }

    // 3. Post Double-Entry Journal
    if (revenueCreditLines.length > 0) {
      const systemCtx = {
        userId: staffId || 'system',
        propertyIds: [order.propertyId],
        organizationId: order.property.organizationId || '',
        role: 'SYSTEM',
        permissions: [],
        outletIds: []
      };

      let totalCredit = 0;
      const lines = revenueCreditLines.map((line, idx) => {
        let finalCredit = line.credit;
        // Last line rounding adjustment
        if (idx === revenueCreditLines.length - 1) {
          finalCredit = Number((amount - totalCredit).toFixed(2));
        }
        totalCredit += finalCredit;
        return {
          accountId: line.accountId,
          debit: 0,
          credit: finalCredit,
          description: `POS Revenue Recognition (${line.fnbClass}) for Order ${order.id}`,
          sourceType: 'POS_PAYMENT',
          sourceId: payment.id,
        };
      });

      // Debit Asset Line
      lines.unshift({
        accountId: debitGlAccountId,
        debit: amount,
        credit: 0,
        description: `POS ${payment.method} Payment for Order ${order.id}`,
        sourceType: 'POS_PAYMENT',
        sourceId: payment.id,
      });

      await GeneralLedgerService.postJournal(
        systemCtx,
        {
          propertyId: order.propertyId,
          entryDate: payment.businessDate || new Date(),
          reference: payment.reference || payment.id,
          description: `POS Settlement - Order ${order.id}`,
          sourceModule: 'POS',
          lines
        },
        tx // Explicitly pass the shared transaction
      );
    }
  }
}
