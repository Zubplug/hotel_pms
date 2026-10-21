/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '@hotel-pms/db';
import { allocationState, sumDecimal, sumSignedDecimal } from '@/lib/finance/billing-contracts';
import { getBillingScope, type BillingScope } from './billing-read-model';

export const PAYMENT_REGISTER_PAGE_SIZE_MAX = 100;
export const PAYMENT_STATUSES = ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'] as const;
export const PAYMENT_METHODS = ['CASH', 'POS', 'BANK_TRANSFER', 'CARD', 'CARD_OFFLINE', 'PAYMENT_GATEWAY', 'MOBILE_PAYMENT', 'CHEQUE', 'ROOM_CHARGE', 'CITY_LEDGER', 'OTHER'] as const;

export type PaymentRegisterFilters = {
  source?: string;
  status?: string;
  method?: string;
  currency?: string;
  query?: string;
  from?: Date;
  to?: Date;
  amountMin?: string;
  amountMax?: string;
  limit?: number;
  cursor?: string;
};

export type PaymentRegisterEntry = {
  paymentId: string;
  receiptNumber: string | null;
  reference: string | null;
  propertyId: string;
  currency: string;
  amount: string;
  baseAmount: string;
  method: string;
  collectionSource: string;
  processingStatus: string;
  verificationStatus: string;
  allocationStatus: 'APPLIED' | 'FULL' | 'PARTIAL' | 'UNALLOCATED' | 'UNKNOWN';
  allocatedAmount: string | null;
  unappliedAmount: string | null;
  postingStatus: 'POSTED' | 'REVERSED' | 'PENDING' | 'UNPOSTED';
  reconciliationStatus: 'MATCHED' | 'EXCEPTION' | 'UNKNOWN';
  reconciliationEvidence: string | null;
  refundStatus: 'NONE' | 'REQUESTED' | 'COMPLETED' | 'FAILED';
  source: { folioId: string; eventInvoiceId: string | null; cityLedgerEntryIds: string[] };
  customer: { kind: 'GUEST' | 'CORPORATE' | 'EVENT' | 'UNKNOWN'; name: string };
  businessDate: string;
  createdAt: string;
  updatedAt: string;
};

type PaymentCursor = { version: 1; createdAt: string; paymentId: string; filterKey: string };

function amount(value: unknown) { return String(value ?? '0'); }
function searchText(value: string | undefined) { return value?.trim() ? { contains: value.trim(), mode: 'insensitive' } : undefined; }
function isUuid(value: string) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function filterKey(filters: PaymentRegisterFilters) {
  return JSON.stringify({ source: filters.source || null, status: filters.status || null, method: filters.method || null, currency: filters.currency || null, query: filters.query?.trim() || null, from: filters.from?.toISOString() || null, to: filters.to?.toISOString() || null, amountMin: filters.amountMin || null, amountMax: filters.amountMax || null });
}
export function encodePaymentCursor(cursor: Omit<PaymentCursor, 'version'>) { return Buffer.from(JSON.stringify({ version: 1, ...cursor }), 'utf8').toString('base64url'); }
export function decodePaymentCursor(value: string | undefined): PaymentCursor | null {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as PaymentCursor;
    if (cursor.version !== 1 || !cursor.paymentId || !cursor.createdAt || !cursor.filterKey || Number.isNaN(new Date(cursor.createdAt).getTime())) return null;
    return cursor;
  } catch { return null; }
}

function postingStatus(lines: any[]): PaymentRegisterEntry['postingStatus'] {
  if (!lines.length) return 'UNPOSTED';
  if (lines.every(line => line.entry.status === 'REVERSED' || line.entry.isReversed)) return 'REVERSED';
  if (lines.some(line => line.entry.status === 'POSTED')) return 'POSTED';
  return 'PENDING';
}

function refundStatus(requests: any[], refunds: any[]): PaymentRegisterEntry['refundStatus'] {
  if (refunds.some(refund => refund.status === 'COMPLETED' || refund.status === 'PAID')) return 'COMPLETED';
  if (requests.some(request => ['FAILED', 'REJECTED', 'CANCELLED', 'EXPIRED'].includes(request.status))) return 'FAILED';
  if (requests.length || refunds.length) return 'REQUESTED';
  return 'NONE';
}

export function normalizePayment(row: any, cityEntries: any[], allocations: any[], journals: any[], exceptions: any[], requests: any[], refunds: any[]): PaymentRegisterEntry {
  const entryIds = cityEntries.map(entry => entry.id);
  const entryAllocationAmounts = allocations.map(allocation => amount(allocation.amount));
  const allocatedAmount = entryAllocationAmounts.length ? sumDecimal(entryAllocationAmounts) : '0';
  const isReceivables = row.collectionSource === 'RECEIVABLES';
  const allocationStatus = isReceivables
    ? allocationState(amount(row.amount), entryAllocationAmounts)
    : row.status === 'COMPLETED' ? 'APPLIED' : 'UNKNOWN';
  const remaining = isReceivables ? sumSignedDecimal([amount(row.amount), `-${allocatedAmount}`]) : null;
  const exception = exceptions.find(item => ['OPEN', 'PENDING_APPROVAL'].includes(item.status));
  const session = row.frontdeskSession;
  const reconciliationStatus = exception || session?.status === 'EXCEPTION'
    ? 'EXCEPTION'
    : session?.status === 'RECONCILED' && row.method === 'CASH' ? 'MATCHED' : 'UNKNOWN';
  const event = row.eventInvoice?.event;
  const folio = row.folio;
  const customer = event?.guest || folio?.guest
    ? { kind: 'GUEST' as const, name: `${(event?.guest || folio?.guest).firstName} ${(event?.guest || folio?.guest).lastName}`.trim() }
    : event?.corporateAccount || folio?.corporateAccount
      ? { kind: 'CORPORATE' as const, name: (event?.corporateAccount || folio?.corporateAccount).name }
      : event ? { kind: 'EVENT' as const, name: event.name || 'Event client' }
      : { kind: 'UNKNOWN' as const, name: 'Unassigned account' };
  return {
    paymentId: row.id, receiptNumber: row.receiptNumber, reference: row.reference, propertyId: row.propertyId,
    currency: row.currency, amount: amount(row.amount), baseAmount: amount(row.baseAmount), method: row.method,
    collectionSource: row.collectionSource, processingStatus: row.status, verificationStatus: row.verificationStatus,
    allocationStatus, allocatedAmount: isReceivables ? allocatedAmount : null, unappliedAmount: remaining,
    postingStatus: postingStatus(journals), reconciliationStatus, reconciliationEvidence: reconciliationStatus === 'MATCHED' ? 'RECONCILED_FRONTDESK_SESSION' : exception ? 'TRANSACTION_EXCEPTION' : session?.status === 'EXCEPTION' ? 'FRONTDESK_SESSION_EXCEPTION' : null,
    refundStatus: refundStatus(requests, refunds), source: { folioId: row.folioId, eventInvoiceId: row.eventInvoiceId, cityLedgerEntryIds: entryIds }, customer,
    businessDate: new Date(row.businessDate).toISOString(), createdAt: new Date(row.createdAt).toISOString(), updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export async function getPaymentRegisterScope(userId: string, propertyId: string, asOf = new Date()) { return getBillingScope(userId, propertyId, asOf); }

export async function listPaymentRegister(scope: BillingScope, filters: PaymentRegisterFilters = {}) {
  const limit = Math.min(Math.max(filters.limit || 25, 1), PAYMENT_REGISTER_PAGE_SIZE_MAX);
  const cursor = decodePaymentCursor(filters.cursor);
  const currentFilterKey = filterKey(filters);
  if (filters.cursor && (!cursor || cursor.filterKey !== currentFilterKey)) throw new Error('INVALID_CURSOR');
  const q = searchText(filters.query);
  const where: any = {
    propertyId: scope.propertyId,
    ...(filters.source ? { collectionSource: filters.source } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.method ? { method: filters.method } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
    ...(filters.from || filters.to ? { createdAt: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
    ...(filters.amountMin || filters.amountMax ? { amount: { ...(filters.amountMin ? { gte: filters.amountMin } : {}), ...(filters.amountMax ? { lte: filters.amountMax } : {}) } } : {}),
    ...(q ? { OR: [...(isUuid(filters.query?.trim() || '') ? [{ id: q }] : []), { receiptNumber: q }, { reference: q }, { providerTransactionId: q }, { folio: { folioNumber: q } }, { folio: { guest: { firstName: q } } }, { folio: { guest: { lastName: q } } }, { eventInvoice: { event: { name: q } } }] } : {}),
    ...(cursor ? { OR: [{ createdAt: { lt: new Date(cursor.createdAt) } }, { createdAt: new Date(cursor.createdAt), id: { gt: cursor.paymentId } }] } : {}),
  };
  const rows = await (prisma as any).payment.findMany({ where, include: { folio: { include: { guest: true, corporateAccount: { select: { name: true } } } }, eventInvoice: { include: { event: { include: { guest: true, corporateAccount: { select: { name: true } } } } } }, frontdeskSession: { select: { status: true } }, refunds: { select: { id: true, status: true } }, refundRequests: { select: { id: true, status: true } }, transactionExceptions: { select: { id: true, status: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: limit + 1 });
  const pageRows = rows.slice(0, limit);
  const references = pageRows.flatMap((row: any) => [row.reference, row.receiptNumber]).filter(Boolean);
  const paymentIds = pageRows.map((row: any) => row.id);
  const [cityEntries, journals] = await Promise.all([
    references.length ? (prisma as any).cityLedgerEntry.findMany({ where: { propertyId: scope.propertyId, type: 'PAYMENT', reference: { in: references } }, select: { id: true, reference: true, amount: true, status: true } }) : [],
    paymentIds.length ? (prisma as any).journalEntryLine.findMany({ where: { sourceId: { in: paymentIds }, sourceType: { in: ['PAYMENT', 'CITY_LEDGER_PAYMENT'] }, entry: { propertyId: scope.propertyId } }, select: { sourceId: true, entry: { select: { status: true, isReversed: true } } } }) : [],
  ]);
  const entriesByReference = new Map<string, any[]>();
  for (const entry of cityEntries) entriesByReference.set(entry.reference, [...(entriesByReference.get(entry.reference) || []), entry]);
  const allocations = cityEntries.length ? await (prisma as any).cityLedgerAllocation.findMany({ where: { paymentId: { in: cityEntries.map((entry: any) => entry.id) } }, select: { id: true, paymentId: true, amount: true } }) : [];
  const result = pageRows.map((row: any) => normalizePayment(row, [...(entriesByReference.get(row.reference) || []), ...(entriesByReference.get(row.receiptNumber) || [])].filter((entry, index, all) => all.findIndex(candidate => candidate.id === entry.id) === index), allocations.filter((allocation: any) => cityEntries.some((entry: any) => entry.id === allocation.paymentId && [row.reference, row.receiptNumber].includes(entry.reference))), journals.filter((line: any) => line.sourceId === row.id), row.transactionExceptions, row.refundRequests, row.refunds));
  const last = pageRows[pageRows.length - 1];
  return { payments: result, hasMore: rows.length > limit, nextCursor: rows.length > limit && last ? encodePaymentCursor({ createdAt: new Date(last.createdAt).toISOString(), paymentId: last.id, filterKey: currentFilterKey }) : null, scope: { organizationId: scope.ctx.organizationId, propertyId: scope.propertyId, currency: scope.currency, asOf: scope.asOf.toISOString(), dateBasis: 'PAYMENT_CREATED_AT', reconciliationBasis: 'EXPLICIT_EVIDENCE_ONLY', cursorVersion: 1 } };
}
