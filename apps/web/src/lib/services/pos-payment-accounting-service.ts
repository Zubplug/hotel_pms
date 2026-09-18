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
    const amount = Number(payment.amount);
    
    // Authoritative totals from the transaction, NOT reverse-engineered from payment.
    const orderTotalGross = Number(order.subtotal);
    const orderTotalDiscount = Number(order.discount);
    const orderTotalTax = Number(order.taxAmount);
    const orderTotalServiceCharge = Number(order.serviceCharge);
    
    // Net order total = Gross - Discount + Tax + ServiceCharge
    const netOrderTotal = Number(order.total);
    
    // Determine the ratio of THIS payment to the ENTIRE order for proportional recognition
    const paymentRatio = netOrderTotal > 0 ? (amount / netOrderTotal) : 1.0;

    const lines: Array<{ accountId: string; debit: number; credit: number; description: string; sourceType: string; sourceId: string; }> = [];

    try {
      // 1. Resolve Asset GL Account for payment
      const debitGlAccountId = await GLMappingService.getAssetAccountForMethod(order.propertyId, payment.method);
      
      lines.push({
        accountId: debitGlAccountId,
        debit: amount,
        credit: 0,
        description: `POS ${payment.method} Payment for Order ${order.id}`,
        sourceType: 'POS_PAYMENT',
        sourceId: payment.id,
      });

      // 2. Resolve & Post Discount Allowance if applicable (Contra-Revenue Debit)
      if (orderTotalDiscount > 0) {
        const discountGlAccountId = await GLMappingService.getDiscountAllowanceAccount(order.propertyId);
        const discountAllocated = Math.round(orderTotalDiscount * paymentRatio * 100) / 100;
        if (discountAllocated > 0) {
          lines.push({
            accountId: discountGlAccountId,
            debit: discountAllocated,
            credit: 0,
            description: `POS Discount Allowance for Order ${order.id}`,
            sourceType: 'POS_PAYMENT',
            sourceId: payment.id,
          });
        }
      }

      // 3. Resolve & Post Tax Liability if applicable (Credit)
      if (orderTotalTax > 0) {
        const taxGlAccountId = await GLMappingService.getTaxPayableAccount(order.propertyId);
        const taxAllocated = Math.round(orderTotalTax * paymentRatio * 100) / 100;
        if (taxAllocated > 0) {
          lines.push({
            accountId: taxGlAccountId,
            debit: 0,
            credit: taxAllocated,
            description: `POS Tax Liability for Order ${order.id}`,
            sourceType: 'POS_PAYMENT',
            sourceId: payment.id,
          });
        }
      }

      // 4. Resolve & Post Service Charge Liability if applicable (Credit)
      if (orderTotalServiceCharge > 0) {
        const scGlAccountId = await GLMappingService.getServiceChargePayableAccount(order.propertyId);
        const scAllocated = Math.round(orderTotalServiceCharge * paymentRatio * 100) / 100;
        if (scAllocated > 0) {
          lines.push({
            accountId: scGlAccountId,
            debit: 0,
            credit: scAllocated,
            description: `POS Service Charge for Order ${order.id}`,
            sourceType: 'POS_PAYMENT',
            sourceId: payment.id,
          });
        }
      }

      // 5. Calculate and Distribute Gross Revenue Credits based on fnbClass proportions
      let orderTotalFromItems = 0;
      const classTotals = new Map<string, number>();

      for (const item of order.items) {
        const fnbClass = item.product?.category?.fnbClass || 'OTHER';
        const itemTotal = Number(item.quantity) * Number(item.unitPrice);
        classTotals.set(fnbClass, (classTotals.get(fnbClass) || 0) + itemTotal);
        orderTotalFromItems += itemTotal;
      }

      // Fallback if no items but subtotal exists
      if (orderTotalFromItems === 0) {
        orderTotalFromItems = orderTotalGross > 0 ? orderTotalGross : amount;
        classTotals.set('OTHER', orderTotalFromItems);
      }

      let totalRevenueCredited = 0;
      // Revenue target is the GROSS revenue proportional to this payment
      const revenueTarget = Math.round(orderTotalGross * paymentRatio * 100) / 100;

      const fnbEntries = Array.from(classTotals.entries());
      for (let i = 0; i < fnbEntries.length; i++) {
        const [fnbClass, classTotal] = fnbEntries[i];
        const accountId = await GLMappingService.getPosRevenueAccount(order.propertyId, fnbClass);
        const proportion = classTotal / orderTotalFromItems;
        
        let classCreditAmount = Math.round(revenueTarget * proportion * 100) / 100;
        
        // Handle rounding on the last item
        if (i === fnbEntries.length - 1) {
          classCreditAmount = Number((revenueTarget - totalRevenueCredited).toFixed(2));
        }
        
        if (classCreditAmount > 0) {
          totalRevenueCredited += classCreditAmount;
          lines.push({
            accountId,
            debit: 0,
            credit: classCreditAmount,
            description: `POS Gross Revenue (${fnbClass}) for Order ${order.id}`,
            sourceType: 'POS_PAYMENT',
            sourceId: payment.id,
          });
        }
      }

      // Safeguard Balancing Adjustments
      let totalDebits = 0;
      let totalCredits = 0;
      for (const line of lines) {
        totalDebits += line.debit;
        totalCredits += line.credit;
      }

      const diff = Number((totalDebits - totalCredits).toFixed(2));
      if (diff !== 0) {
         // If rounding error happens, adjust it into the last revenue line
         const lastRevLine = lines.slice().reverse().find(l => l.credit > 0);
         if (lastRevLine) {
            lastRevLine.credit = Number((lastRevLine.credit + diff).toFixed(2));
         } else {
            throw new Error(`CRITICAL_ACCOUNTING_ERROR: Cannot balance journal for order ${order.id}`);
         }
      }

    } catch (e: any) {
      if (e.message?.includes('Missing') || e.message?.includes('mapping required') || e.message?.includes('is missing')) {
        throw new Error(`RETRYABLE_ACCOUNTING_CONFIG: Accounting Configuration Required: ${e.message}`);
      }
      throw e;
    }

    if (lines.length > 0) {
      const systemCtx = {
        userId: staffId || 'system',
        propertyIds: [order.propertyId],
        organizationId: order.property.organizationId || '',
        role: 'SYSTEM',
        permissions: [],
        outletIds: []
      } as any;

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
        tx
      );
    }
  }
}
