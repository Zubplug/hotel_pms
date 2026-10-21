/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '@hotel-pms/db';
import { sumDecimal, sumSignedDecimal } from '@/lib/finance/billing-contracts';
import { getBillingScope, listBillingDocuments, type BillingDocument, type BillingScope } from './billing-read-model';

export type ReferenceLinkStatus = 'RESOLVED' | 'MISSING_REFERENCE' | 'MALFORMED_REFERENCE' | 'AMBIGUOUS_REFERENCE';
export type ReferenceLink = { status: ReferenceLinkStatus; normalizedReference: string | null; entryIds: string[]; reason: string | null };

export type ReceivableRow = BillingDocument & {
  collectible: boolean;
  allocationStatus: 'FOLIO_APPLIED' | 'FULL' | 'PARTIAL' | 'UNALLOCATED' | 'SOURCE_PAID_AMOUNT';
  allocatedAmount: string | null;
  allocationIds: string[];
  receiptEntryIds: string[];
  allocationVariance: string | null;
};

export function normalizeReceiptReference(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/g, ' ').toUpperCase();
  if (!normalized || normalized.length > 200 || /[\u0000-\u001f\u007f]/.test(normalized)) return null;
  return normalized;
}

export function resolvePaymentEntryReference(payment: { reference?: unknown; receiptNumber?: unknown }, entries: Array<{ id: string; reference?: unknown }>): ReferenceLink {
  const rawValues = [payment.reference, payment.receiptNumber].filter(value => value !== null && value !== undefined && String(value).trim() !== '');
  if (!rawValues.length) return { status: 'MISSING_REFERENCE', normalizedReference: null, entryIds: [], reason: 'Payment has neither reference nor receipt number.' };
  const normalizedValues = rawValues.map(normalizeReceiptReference);
  if (normalizedValues.some(value => value === null)) return { status: 'MALFORMED_REFERENCE', normalizedReference: null, entryIds: [], reason: 'Payment reference contains invalid control characters or exceeds the supported length.' };
  const references = new Set(normalizedValues as string[]);
  const candidates = entries.filter(entry => references.has(normalizeReceiptReference(entry.reference) || '')).map(entry => entry.id);
  const uniqueIds = Array.from(new Set(candidates));
  if (!uniqueIds.length) return { status: 'MISSING_REFERENCE', normalizedReference: Array.from(references)[0] || null, entryIds: [], reason: 'No City Ledger payment entry matched the normalized reference.' };
  if (uniqueIds.length > 1) return { status: 'AMBIGUOUS_REFERENCE', normalizedReference: Array.from(references).join(' | '), entryIds: uniqueIds, reason: 'More than one City Ledger payment entry matched the payment reference.' };
  return { status: 'RESOLVED', normalizedReference: Array.from(references)[0] || null, entryIds: uniqueIds, reason: null };
}

function positiveDecimal(value: string) {
  const normalized = sumSignedDecimal([value]);
  return normalized !== '0' && !normalized.startsWith('-');
}

function allocationStateForDocument(document: BillingDocument, allocationAmount: string | null): ReceivableRow['allocationStatus'] {
  if (document.source === 'FOLIO') return 'FOLIO_APPLIED';
  if (document.source === 'EVENT_INVOICE') return 'SOURCE_PAID_AMOUNT';
  if (!allocationAmount || allocationAmount === '0') return 'UNALLOCATED';
  return allocationAmount === document.paidAmount ? 'FULL' : 'PARTIAL';
}

export async function getReceivablesScope(userId: string, propertyId: string, asOf = new Date()) { return getBillingScope(userId, propertyId, asOf); }

export async function listReceivables(scope: BillingScope, filters: { currency?: string; query?: string; limit?: number; cursor?: string } = {}) {
  const documentsResult = await listBillingDocuments(scope, { currency: filters.currency, query: filters.query, limit: Math.min(filters.limit || 50, 100), cursor: filters.cursor });
  const documents = documentsResult.documents.filter(document => document.sourceStatus !== 'VOID' && positiveDecimal(document.outstandingAmount));
  const cityInvoiceIds = documents.filter(document => document.source === 'CITY_LEDGER_INVOICE').map(document => document.sourceId);
  const allocations = cityInvoiceIds.length ? await (prisma as any).cityLedgerAllocation.findMany({ where: { invoiceId: { in: cityInvoiceIds }, invoice: { propertyId: scope.propertyId } }, select: { id: true, invoiceId: true, paymentId: true, amount: true, currency: true, payment: { select: { id: true, reference: true, status: true } } } }) : [];
  const allocationByInvoice = new Map<string, any[]>();
  for (const allocation of allocations) allocationByInvoice.set(allocation.invoiceId, [...(allocationByInvoice.get(allocation.invoiceId) || []), allocation]);
  const receivables: ReceivableRow[] = documents.map(document => {
    const invoiceAllocations = allocationByInvoice.get(document.sourceId) || [];
    const allocatedAmount = invoiceAllocations.length ? sumDecimal(invoiceAllocations.map((allocation: any) => String(allocation.amount))) : null;
    const allocationVariance = allocatedAmount === null || document.source !== 'CITY_LEDGER_INVOICE' ? null : sumSignedDecimal([allocatedAmount, `-${document.paidAmount}`]);
    return { ...document, collectible: true, allocationStatus: allocationStateForDocument(document, allocatedAmount), allocatedAmount, allocationIds: invoiceAllocations.map((allocation: any) => allocation.id), receiptEntryIds: invoiceAllocations.map((allocation: any) => allocation.paymentId), allocationVariance };
  });
  const advances = await listUnappliedCorporateAdvances(scope, filters.currency);
  const linkageExceptions = advances.linkageExceptions;
  return { receivables, unappliedAdvances: advances.rows, linkageExceptions, hasMore: documentsResult.hasMore, nextCursor: documentsResult.nextCursor, scope: { ...documentsResult.scope, receivableBalanceBasis: 'FOLIO_DEBIT_OR_CITY_LEDGER_OUTSTANDING', agingBasis: 'UNAVAILABLE_WHERE_DUE_DATE_IS_NOT_AUTHORITATIVE' } };
}

async function listUnappliedCorporateAdvances(scope: BillingScope, currency?: string) {
  const payments = await (prisma as any).payment.findMany({ where: { propertyId: scope.propertyId, collectionSource: 'RECEIVABLES', status: 'COMPLETED', ...(currency ? { currency } : {}) }, select: { id: true, reference: true, receiptNumber: true, amount: true, currency: true, createdAt: true }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: 100 });
  const references = payments.flatMap((payment: any) => [payment.reference, payment.receiptNumber]).filter(Boolean);
  const entries = references.length ? await (prisma as any).cityLedgerEntry.findMany({ where: { propertyId: scope.propertyId, type: 'PAYMENT', reference: { in: references } }, select: { id: true, reference: true, amount: true, currency: true, status: true, account: { select: { id: true, name: true } } } }) : [];
  const entryIds = entries.map((entry: any) => entry.id);
  const allocations = entryIds.length ? await (prisma as any).cityLedgerAllocation.findMany({ where: { paymentId: { in: entryIds } }, select: { paymentId: true, amount: true, invoiceId: true } }) : [];
  const rows: any[] = [];
  const linkageExceptions: any[] = [];
  for (const payment of payments) {
    const link = resolvePaymentEntryReference(payment, entries);
    if (link.status !== 'RESOLVED') { linkageExceptions.push({ paymentId: payment.id, reference: payment.reference || payment.receiptNumber || null, ...link }); continue; }
    const linkedEntries = entries.filter((entry: any) => link.entryIds.includes(entry.id));
    const allocated = allocations.filter((allocation: any) => link.entryIds.includes(allocation.paymentId));
    const allocatedAmount = allocated.length ? sumDecimal(allocated.map((allocation: any) => String(allocation.amount))) : '0';
    const unappliedAmount = sumSignedDecimal([String(payment.amount), `-${allocatedAmount}`]);
    if (positiveDecimal(unappliedAmount)) rows.push({ paymentId: payment.id, receiptNumber: payment.receiptNumber, reference: payment.reference, amount: String(payment.amount), allocatedAmount, unappliedAmount, currency: payment.currency, account: linkedEntries[0]?.account || null, entryIds: link.entryIds, allocationIds: allocated.map((allocation: any) => allocation.paymentId), createdAt: new Date(payment.createdAt).toISOString(), status: linkedEntries[0]?.status || 'OPEN' });
  }
  return { rows, linkageExceptions };
}
