import { GLMappingService } from './gl-mapping-service';
import { GeneralLedgerService } from './general-ledger-service';

type CommerceAccountingInput = {
  tx: any;
  paymentId: string;
  orderId: string;
  propertyId: string;
  organizationId: string;
  targetOutletId?: string | null;
  paymentMethod: string;
  amount: number;
  businessDate: Date;
};

/**
 * Posts a verified public Commerce payment into the property's existing GL.
 *
 * This deliberately does not create a PosOrder. The POS remains the
 * fulfillment system, while Commerce is the online financial source. The
 * payment row is the idempotency boundary shared with the POS bridge.
 */
export class CommercePaymentAccountingService {
  static async processPaymentAccounting(input: CommerceAccountingInput) {
    const { tx } = input;
    const payment = await tx.commercePayment.findUnique({
      where: { id: input.paymentId },
      select: { id: true, accountingStatus: true, accountingJournalId: true },
    });
    if (!payment) throw new Error('Commerce payment not found for accounting.');
    if (payment.accountingStatus === 'POSTED') return payment.accountingJournalId;

    const order = await tx.commerceOrder.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        subtotal: true,
        deliveryFee: true,
        discountAmount: true,
        taxAmount: true,
        totalAmount: true,
        items: { select: { productId: true, quantity: true, unitPrice: true, totalPrice: true } },
      },
    });
    if (!order) throw new Error('Commerce order not found for accounting.');

    const paymentAmount = Number(input.amount);
    const grossSubtotal = Number(order.subtotal);
    const discount = Number(order.discountAmount);
    const tax = Number(order.taxAmount);
    const deliveryFee = Number(order.deliveryFee);
    const orderTotal = Number(order.totalAmount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || !Number.isFinite(orderTotal) || orderTotal <= 0) {
      throw new Error('Commerce payment has invalid accounting totals.');
    }

    const paymentRatio = orderTotal > 0 ? paymentAmount / orderTotal : 1;
    const lines: Array<{
      accountId: string;
      debit: number;
      credit: number;
      description: string;
      sourceType: string;
      sourceId: string;
      departmentId?: string;
      outletId?: string;
    }> = [];
    const sourceType = 'COMMERCE_PAYMENT';
    const sourceId = input.paymentId;

    const tenderAccount = await GLMappingService.getAssetAccountForMethod(input.propertyId, input.paymentMethod);
    lines.push({
      accountId: tenderAccount,
      debit: paymentAmount,
      credit: 0,
      description: `Online Commerce payment for Order ${order.id}`,
      sourceType,
      sourceId,
    });

    if (discount > 0) {
      lines.push({
        accountId: await GLMappingService.getDiscountAllowanceAccount(input.propertyId),
        debit: Math.round(discount * paymentRatio * 100) / 100,
        credit: 0,
        description: `Online Commerce discount for Order ${order.id}`,
        sourceType,
        sourceId,
      });
    }

    if (tax > 0) {
      lines.push({
        accountId: await GLMappingService.getTaxPayableAccount(input.propertyId),
        debit: 0,
        credit: Math.round(tax * paymentRatio * 100) / 100,
        description: `Online Commerce tax for Order ${order.id}`,
        sourceType,
        sourceId,
      });
    }

    const outlet = input.targetOutletId
      ? await tx.posOutlet.findUnique({ where: { id: input.targetOutletId }, select: { type: true } })
      : null;
    const isRecreationOutlet = String(outlet?.type || '').toUpperCase() === 'RECREATION';
    const department = await tx.department.findFirst({
      where: {
        propertyId: input.propertyId,
        name: { in: isRecreationOutlet ? ['Recreation', 'Pool'] : ['F&B', 'Food & Beverage', 'Food and Beverage'] },
      },
      select: { id: true },
    });

    const productIds = order.items.map((item: any) => item.productId);
    const commerceProducts = await tx.commerceProduct.findMany({
      where: { id: { in: productIds } },
      select: { id: true, posProductId: true },
    });
    const posProductIds = commerceProducts.map((product: any) => product.posProductId).filter(Boolean);
    const posProducts = await tx.posProduct.findMany({
      where: { id: { in: posProductIds }, propertyId: input.propertyId },
      select: { id: true, itemCode: true, category: { select: { name: true, fnbClass: true } } },
    });
    const commerceProductMap = new Map<string, any>(commerceProducts.map((product: any) => [product.id, product]));
    const posProductMap = new Map<string, any>(posProducts.map((product: any) => [product.id, product]));
    const classTotals = new Map<string, number>();
    let itemTotal = 0;

    for (const item of order.items) {
      const commerceProduct = commerceProductMap.get(item.productId);
      const posProduct = commerceProduct?.posProductId ? posProductMap.get(commerceProduct.posProductId) : null;
      const categoryName = String(posProduct?.category?.name || '').toLowerCase();
      const isPoolItem = isRecreationOutlet || String(posProduct?.itemCode || '').startsWith('REC-POOL') || categoryName.includes('pool');
      const fnbClass = isPoolItem ? 'POOL' : (String(posProduct?.category?.fnbClass || 'FOOD') === 'OTHER' ? 'FOOD' : String(posProduct?.category?.fnbClass || 'FOOD'));
      const lineTotal = Number(item.totalPrice);
      classTotals.set(fnbClass, (classTotals.get(fnbClass) || 0) + lineTotal);
      itemTotal += lineTotal;
    }

    if (itemTotal <= 0) {
      itemTotal = grossSubtotal;
      classTotals.set(isRecreationOutlet ? 'POOL' : 'FOOD', itemTotal);
    }

    const revenueTarget = Math.round(grossSubtotal * paymentRatio * 100) / 100;
    let revenueCredited = 0;
    const revenueEntries = Array.from(classTotals.entries());
    for (let index = 0; index < revenueEntries.length; index += 1) {
      const [fnbClass, classTotal] = revenueEntries[index];
      let credit = Math.round(revenueTarget * (classTotal / itemTotal) * 100) / 100;
      if (index === revenueEntries.length - 1) credit = Number((revenueTarget - revenueCredited).toFixed(2));
      if (credit <= 0) continue;
      revenueCredited += credit;
      lines.push({
        accountId: await GLMappingService.getPosRevenueAccount(input.propertyId, fnbClass),
        debit: 0,
        credit,
        description: `Online Commerce ${fnbClass} revenue for Order ${order.id}`,
        sourceType,
        sourceId,
        departmentId: department?.id,
        outletId: input.targetOutletId ?? undefined,
      });
    }

    if (deliveryFee > 0) {
      lines.push({
        accountId: await GLMappingService.getOtherRevenueAccount(input.propertyId),
        debit: 0,
        credit: Math.round(deliveryFee * paymentRatio * 100) / 100,
        description: `Online Commerce delivery fee for Order ${order.id}`,
        sourceType,
        sourceId,
        departmentId: department?.id,
        outletId: input.targetOutletId ?? undefined,
      });
    }

    const debitTotal = lines.reduce((sum, line) => sum + line.debit, 0);
    const creditTotal = lines.reduce((sum, line) => sum + line.credit, 0);
    const balancingDifference = Number((debitTotal - creditTotal).toFixed(2));
    if (balancingDifference !== 0) {
      const lastCredit = [...lines].reverse().find((line) => line.credit > 0);
      if (!lastCredit) throw new Error('Commerce accounting journal could not be balanced.');
      lastCredit.credit = Number((lastCredit.credit + balancingDifference).toFixed(2));
    }

    const journal = await GeneralLedgerService.postJournal({
      // JournalEntry.createdBy is UUID-backed. The Commerce payment UUID is
      // used as the immutable system actor for this automated posting; the
      // audit description and source fields identify it as Commerce.
      userId: input.paymentId,
      propertyIds: [input.propertyId],
      organizationId: input.organizationId,
      role: 'SYSTEM',
      permissions: [],
      outletIds: [],
    } as any, {
      propertyId: input.propertyId,
      entryDate: input.businessDate,
      reference: `COMMERCE_PAYMENT:${input.paymentId}`,
      description: `Online Commerce settlement - Order ${order.id}`,
      sourceModule: 'COMMERCE',
      lines,
    }, tx);

    await tx.commercePayment.update({
      where: { id: input.paymentId },
      data: {
        accountingStatus: 'POSTED',
        accountingJournalId: journal.id,
        accountingPostedAt: new Date(),
        accountingFailureReason: null,
      },
    });
    return journal.id;
  }
}
