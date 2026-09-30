import { GLMappingService } from '@/lib/services/gl-mapping-service';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';

/** Posts one corporate event/hall invoice's revenue at its service date. */
export async function postEventInvoiceRevenue(
  tx: any,
  input: {
    propertyId: string;
    organizationId: string;
    userId: string;
    entryDate: Date;
    invoice: any;
  },
) {
  const invoice = input.invoice;
  if (!invoice.cityLedgerAccountId) return false;
  if (!['ISSUED', 'PARTIAL', 'PAID'].includes(invoice.status)) return false;

  const reference = `EVENT-INVOICE-${invoice.id}`;
  const existing = await tx.journalEntry.findFirst({
    where: { propertyId: input.propertyId, reference, status: 'POSTED', isReversed: false },
    select: { id: true },
  });
  if (existing) return false;

  const lines = (invoice.items || []).map((item: any) => ({
    item,
    gross: Number(item.grossAmount || item.totalPrice),
    discount: Number(item.discountAmount || 0),
    tax: Number(item.taxAmount || 0),
    category: String(item.category || 'OTHER').toUpperCase(),
  }));
  const revenueAccountByCategory = new Map<string, string>();
  for (const category of [...new Set(lines.map((line: any) => line.category))]) {
    revenueAccountByCategory.set(category, await GLMappingService.getEventRevenueAccount(input.propertyId, category));
  }

  const discountAccountId = await GLMappingService.getDiscountAllowanceAccount(input.propertyId);
  const taxAccountId = await GLMappingService.getTaxPayableAccount(input.propertyId);
  const cityLedgerAccountId = await GLMappingService.getCityLedgerAccount(input.propertyId);

  await GeneralLedgerService.postJournal({
    userId: input.userId,
    propertyIds: [input.propertyId],
    organizationId: input.organizationId,
    role: 'SYSTEM',
    permissions: [],
    outletIds: [],
  }, {
    propertyId: input.propertyId,
    entryDate: input.entryDate,
    reference,
    description: `Recognize event revenue for ${invoice.id}`,
    sourceModule: 'AR',
    lines: [
      { accountId: cityLedgerAccountId, debit: Number(invoice.totalAmount), credit: 0, description: 'Event city-ledger receivable', sourceType: 'EVENT_INVOICE', sourceId: invoice.id },
      ...lines.filter((line: any) => line.gross > 0).map((line: any) => ({ accountId: revenueAccountByCategory.get(line.category)!, debit: 0, credit: line.gross, description: line.item.description, sourceType: 'EVENT_INVOICE_ITEM', sourceId: line.item.id })),
      ...lines.filter((line: any) => line.discount > 0).map((line: any) => ({ accountId: discountAccountId, debit: line.discount, credit: 0, description: `${line.item.description} discount`, sourceType: 'EVENT_INVOICE_ITEM', sourceId: line.item.id })),
      ...lines.filter((line: any) => line.tax > 0).map((line: any) => ({ accountId: taxAccountId, debit: 0, credit: line.tax, description: `${line.item.description} tax`, sourceType: 'EVENT_INVOICE_ITEM', sourceId: line.item.id })),
    ],
  }, tx);

  return true;
}
