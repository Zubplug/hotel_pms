/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from '@hotel-pms/db';
import { requireOrganizationContext, type TenantContext } from '@/lib/organization-access';
import { hasFinancialRole } from '@/lib/financial-control-access';
import { getFolioBalance } from '@/lib/finance/folio-balance';
import { allocationState, sumDecimal, sumSignedDecimal } from '@/lib/finance/billing-contracts';

export const BILLING_READ_ROLES = ['ACCOUNTANT', 'FINANCE_MANAGER', 'GENERAL_CASHIER', 'NIGHT_AUDITOR', 'MANAGER', 'HOTEL_MANAGER', 'GENERAL_MANAGER', 'DIRECTOR', 'CEO', 'EXECUTIVE', 'ADMIN', 'SUPER_ADMIN', 'OWNER', 'AUDITOR'] as const;
export const BILLING_SOURCES = ['FOLIO', 'CITY_LEDGER_INVOICE', 'EVENT_INVOICE'] as const;
export const BILLING_PAGE_SIZE_MAX = 100;
export type BillingSource = typeof BILLING_SOURCES[number];

export type BillingDocument = {
  source: BillingSource;
  sourceId: string;
  organizationId: string;
  propertyId: string;
  reference: string;
  customer: { kind: 'GUEST' | 'CORPORATE' | 'EVENT' | 'UNKNOWN'; id?: string; name: string };
  issueDate: string | null;
  dueDate: string | null;
  currency: string;
  grossAmount: string;
  paidAmount: string;
  outstandingAmount: string;
  sourceStatus: string;
  settlementStatus: 'DRAFT' | 'ISSUED' | 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'VOID';
  workflowStatus?: string;
  balanceAuthority: 'FOLIO_COUNTERS' | 'CITY_LEDGER_INVOICE' | 'EVENT_INVOICE';
  description: string;
  related: { paymentIds: string[]; allocationIds: string[]; creditIds: string[]; refundIds: string[]; journalIds: string[] };
};

export type BillingFilters = {
  propertyId: string;
  source?: BillingSource;
  status?: string;
  query?: string;
  currency?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  cursor?: string;
};

export type BillingScope = {
  ctx: TenantContext;
  propertyId: string;
  currency: string | null;
  asOf: Date;
};

function iso(value: Date | null | undefined) { return value ? new Date(value).toISOString() : null; }
function amount(value: unknown) { return String(value ?? '0'); }
function positive(value: unknown) { return Number(value || 0) > 0.0001; }
function sourceStatus(status: string, outstanding: string, dueDate: Date | null, asOf: Date): BillingDocument['settlementStatus'] {
  if (status === 'VOID') return 'VOID';
  if (status === 'DRAFT') return 'DRAFT';
  if (!positive(outstanding)) return 'PAID';
  if (dueDate && dueDate.getTime() < asOf.getTime()) return 'OVERDUE';
  if (status === 'PARTIAL' || status === 'PARTIALLY_PAID') return 'PARTIAL';
  return status === 'ISSUED' ? 'ISSUED' : 'UNPAID';
}

function searchText(query: string | undefined) {
  const value = query?.trim();
  return value ? { contains: value, mode: 'insensitive' } : undefined;
}

function baseWhere(filters: BillingFilters, dateField = 'createdAt') {
  return {
    propertyId: filters.propertyId,
    ...(filters.currency ? { currency: filters.currency } : {}),
    ...(filters.from || filters.to ? { [dateField]: { ...(filters.from ? { gte: filters.from } : {}), ...(filters.to ? { lte: filters.to } : {}) } } : {}),
  };
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function canReadBilling(role: unknown) {
  return hasFinancialRole(role, BILLING_READ_ROLES);
}

export function resolveBillingMetricCurrency(currencies: string[], baseCurrency: string | null) {
  const unique = Array.from(new Set(currencies.filter(Boolean)));
  return unique.length <= 1 ? (unique[0] || baseCurrency) : null;
}

type BillingCursor = { version: 1; sortDate: string; source: BillingSource; sourceId: string; filterKey: string };

function registerFilterKey(filters: Omit<BillingFilters, 'propertyId' | 'cursor' | 'limit'>) {
  return JSON.stringify({ source: filters.source || null, status: filters.status || null, query: filters.query?.trim() || null, currency: filters.currency || null, from: filters.from?.toISOString() || null, to: filters.to?.toISOString() || null });
}

export function encodeBillingCursor(cursor: Omit<BillingCursor, 'version'>) {
  return Buffer.from(JSON.stringify({ version: 1, ...cursor }), 'utf8').toString('base64url');
}

export function decodeBillingCursor(value: string | undefined): BillingCursor | null {
  if (!value) return null;
  try {
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as BillingCursor;
    if (cursor.version !== 1 || !BILLING_SOURCES.includes(cursor.source) || !cursor.sourceId || !cursor.sortDate || !cursor.filterKey || Number.isNaN(new Date(cursor.sortDate).getTime())) return null;
    return cursor;
  } catch {
    return null;
  }
}

function sourceRank(source: BillingSource) {
  return BILLING_SOURCES.indexOf(source);
}

function keysetWhere(source: BillingSource, cursor: BillingCursor | null, dateField: string) {
  if (!cursor) return {};
  const date = new Date(cursor.sortDate);
  const rank = sourceRank(source);
  const cursorRank = sourceRank(cursor.source);
  const dateBefore = { [dateField]: { lt: date } };
  if (rank > cursorRank) return { OR: [dateBefore, { [dateField]: date }] };
  if (rank < cursorRank) return dateBefore;
  return { OR: [dateBefore, { AND: [{ [dateField]: date }, { id: { gt: cursor.sourceId } }] }] };
}

function registerSortDate(source: BillingSource, row: any) {
  return source === 'CITY_LEDGER_INVOICE' ? new Date(row.issueDate) : new Date(row.createdAt);
}

export function compareBillingRegisterEntries(a: { sortDate: Date; source: BillingSource; sourceId: string }, b: { sortDate: Date; source: BillingSource; sourceId: string }) {
  return b.sortDate.getTime() - a.sortDate.getTime() || sourceRank(a.source) - sourceRank(b.source) || a.sourceId.localeCompare(b.sourceId);
}

export function normalizeFolio(row: any, organizationId: string, asOf: Date): BillingDocument {
  const balance = getFolioBalance({ balance: row.balance, totalCharges: row.totalCharges, totalPayments: row.totalPayments });
  const outstanding = amount(balance.debit.toFixed(4));
  const status = sourceStatus(row.status === 'CLOSED' ? 'PAID' : row.status, outstanding, null, asOf);
  const guest = row.guest;
  return {
    source: 'FOLIO', sourceId: row.id, organizationId, propertyId: row.propertyId,
    reference: row.folioNumber, customer: guest
      ? { kind: 'GUEST', id: guest.id, name: `${guest.firstName} ${guest.lastName}`.trim() }
      : row.corporateAccount ? { kind: 'CORPORATE', id: row.corporateAccount.id, name: row.corporateAccount.name } : { kind: 'UNKNOWN', name: 'Unassigned account' },
    issueDate: iso(row.createdAt), dueDate: null, currency: row.currency,
    grossAmount: amount(row.totalCharges), paidAmount: amount(row.totalPayments), outstandingAmount: outstanding,
    sourceStatus: row.status, settlementStatus: status, balanceAuthority: 'FOLIO_COUNTERS', description: `${row.type} folio`,
    related: { paymentIds: (row.payments || []).map((payment: any) => payment.id), allocationIds: [], creditIds: (row.credits || []).map((credit: any) => credit.id), refundIds: (row.refunds || []).map((refund: any) => refund.id), journalIds: [] },
  };
}

export function normalizeCityInvoice(row: any, organizationId: string, asOf: Date): BillingDocument {
  return {
    source: 'CITY_LEDGER_INVOICE', sourceId: row.id, organizationId, propertyId: row.propertyId,
    reference: row.invoiceNumber, customer: { kind: 'CORPORATE', id: row.account.id, name: row.account.name },
    issueDate: iso(row.issueDate), dueDate: iso(row.dueDate), currency: row.currency,
    grossAmount: amount(row.amount), paidAmount: amount(row.paidAmount), outstandingAmount: amount(row.outstandingAmount),
    sourceStatus: row.status, settlementStatus: sourceStatus(row.status, amount(row.outstandingAmount), row.dueDate, asOf),
    balanceAuthority: 'CITY_LEDGER_INVOICE', description: row.description,
    related: { paymentIds: (row.allocations || []).map((allocation: any) => allocation.paymentId || allocation.payment?.id).filter(Boolean), allocationIds: (row.allocations || []).map((allocation: any) => allocation.id), creditIds: [], refundIds: [], journalIds: [] },
  };
}

export function normalizeEventInvoice(row: any, organizationId: string, asOf: Date): BillingDocument {
  const event = row.event;
  const customer = event?.guest
    ? { kind: 'GUEST' as const, id: event.guest.id, name: `${event.guest.firstName} ${event.guest.lastName}`.trim() }
    : event?.corporateAccount
      ? { kind: 'CORPORATE' as const, id: event.corporateAccount.id, name: event.corporateAccount.name }
      : { kind: 'EVENT' as const, id: event?.id, name: event?.name || 'Event client' };
  const outstanding = sumSignedDecimal([amount(row.totalAmount), `-${amount(row.paidAmount)}`]);
  const linkedAllocations = row.cityLedgerInvoice?.allocations || [];
  return {
    source: 'EVENT_INVOICE', sourceId: row.id, organizationId, propertyId: row.propertyId,
    reference: `EVENT-${row.id.slice(0, 8).toUpperCase()}`, customer,
    issueDate: iso(row.issuedAt || row.createdAt), dueDate: iso(row.leaseBillingSchedule?.dueDate), currency: row.currency,
    grossAmount: amount(row.totalAmount), paidAmount: amount(row.paidAmount), outstandingAmount: outstanding,
    sourceStatus: row.status, settlementStatus: sourceStatus(row.status, outstanding, null, asOf), workflowStatus: row.workflowStatus,
    balanceAuthority: 'EVENT_INVOICE', description: event?.name || 'Event invoice',
    related: { paymentIds: [...(row.payments || []).map((payment: any) => payment.id), ...linkedAllocations.map((allocation: any) => allocation.paymentId).filter(Boolean)], allocationIds: linkedAllocations.map((allocation: any) => allocation.id), creditIds: [], refundIds: [], journalIds: [] },
  };
}

export async function getBillingScope(userId: string, propertyId: string, asOf = new Date()): Promise<BillingScope> {
  const ctx = await requireOrganizationContext(userId);
  if (!ctx.propertyIds.includes(propertyId)) throw new Error('FORBIDDEN');
  const assignedRoles = await (prisma as any).userRole.findMany({
    where: { userId, OR: [{ propertyId }, { propertyId: null }], role: { organizationId: ctx.organizationId } },
    select: { role: { select: { name: true } } },
  });
  const roles = [ctx.role, ...assignedRoles.map((assignment: any) => assignment.role.name)];
  if (!roles.some(canReadBilling)) throw new Error('FORBIDDEN');
  const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { baseCurrency: true, organizationId: true } });
  if (!property || property.organizationId !== ctx.organizationId) throw new Error('FORBIDDEN');
  return { ctx, propertyId, currency: property.baseCurrency, asOf };
}

export async function listBillingDocuments(scope: BillingScope, filters: Omit<BillingFilters, 'propertyId'> = {}) {
  const full = { ...filters, propertyId: scope.propertyId };
  const limit = Math.min(Math.max(filters.limit || 25, 1), BILLING_PAGE_SIZE_MAX);
  const q = searchText(filters.query);
  const sourceSet = filters.source ? [filters.source] : BILLING_SOURCES;
  const cursor = decodeBillingCursor(filters.cursor);
  const filterKey = registerFilterKey(filters);
  if (filters.cursor && (!cursor || cursor.filterKey !== filterKey)) throw new Error('INVALID_CURSOR');
  const [folios, cityInvoices, eventInvoices] = await Promise.all([
    sourceSet.includes('FOLIO') ? (prisma as any).folio.findMany({ where: { ...baseWhere(full), ...keysetWhere('FOLIO', cursor, 'createdAt'), type: { not: 'CITY_LEDGER' }, status: { not: 'VOID' }, ...(q ? { OR: [{ folioNumber: q }, { guest: { firstName: q } }, { guest: { lastName: q } }] } : {}) }, include: { guest: true, corporateAccount: { select: { id: true, name: true } }, payments: { select: { id: true } }, credits: { select: { id: true } }, refunds: { select: { id: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: limit + 1 }) : [],
    sourceSet.includes('CITY_LEDGER_INVOICE') ? (prisma as any).cityLedgerInvoice.findMany({ where: { ...baseWhere(full, 'issueDate'), ...keysetWhere('CITY_LEDGER_INVOICE', cursor, 'issueDate'), ...(filters.status ? { status: filters.status } : {}), ...(q ? { OR: [{ invoiceNumber: q }, { description: q }, { account: { name: q } }] } : {}) }, include: { account: { select: { id: true, name: true } }, allocations: { select: { id: true } } }, orderBy: [{ issueDate: 'desc' }, { id: 'asc' }], take: limit + 1 }) : [],
    sourceSet.includes('EVENT_INVOICE') ? (prisma as any).eventInvoice.findMany({ where: { ...baseWhere(full), ...keysetWhere('EVENT_INVOICE', cursor, 'createdAt'), cityLedgerInvoice: null, ...(filters.status ? { status: filters.status } : {}), ...(q ? { OR: [...(isUuid(q) ? [{ id: q }] : []), { event: { name: q } }] } : {}) }, include: { event: { include: { guest: true, corporateAccount: { select: { id: true, name: true } } } }, leaseBillingSchedule: { select: { dueDate: true } }, payments: { select: { id: true } } }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], take: limit + 1 }) : [],
  ]);
  const all = [
    ...(folios as any[]).map(row => ({ document: normalizeFolio(row, scope.ctx.organizationId, scope.asOf), sortDate: registerSortDate('FOLIO', row) })),
    ...(cityInvoices as any[]).map(row => ({ document: normalizeCityInvoice(row, scope.ctx.organizationId, scope.asOf), sortDate: registerSortDate('CITY_LEDGER_INVOICE', row) })),
    ...(eventInvoices as any[]).map(row => ({ document: normalizeEventInvoice(row, scope.ctx.organizationId, scope.asOf), sortDate: registerSortDate('EVENT_INVOICE', row) })),
  ].filter(row => !filters.status || row.document.settlementStatus === filters.status || row.document.sourceStatus === filters.status)
    .sort((a, b) => compareBillingRegisterEntries({ sortDate: a.sortDate, source: a.document.source, sourceId: a.document.sourceId }, { sortDate: b.sortDate, source: b.document.source, sourceId: b.document.sourceId }));
  const documents = all.slice(0, limit).map(row => row.document);
  const hasMore = all.length > limit;
  const last = all[limit - 1];
  return { documents, hasMore, nextCursor: hasMore && last ? encodeBillingCursor({ sortDate: last.sortDate.toISOString(), source: last.document.source, sourceId: last.document.sourceId, filterKey }) : null, scope: { organizationId: scope.ctx.organizationId, propertyId: scope.propertyId, currency: scope.currency, asOf: scope.asOf.toISOString(), postingBasis: 'SOURCE_AUTHORITATIVE_BALANCE', ordering: 'sortDate DESC, source ASC, sourceId ASC', cursorVersion: 1 } };
}

export async function getBillingOverview(scope: BillingScope, filters: Omit<BillingFilters, 'propertyId' | 'limit'> = {}) {
  const result = await listBillingDocuments(scope, { ...filters, limit: 8 });
  const queryBase = baseWhere({ ...filters, propertyId: scope.propertyId });
  const [folioAggregate, cityAggregate, eventAggregate, overdueAggregate, currencyRows] = await Promise.all([
    (prisma as any).folio.aggregate({ where: { ...queryBase, type: { not: 'CITY_LEDGER' }, status: { not: 'VOID' } }, _count: { _all: true }, _sum: { totalCharges: true, totalPayments: true, balance: true } }),
    (prisma as any).cityLedgerInvoice.aggregate({ where: { ...queryBase, status: { not: 'VOID' } }, _count: { _all: true }, _sum: { amount: true, paidAmount: true, outstandingAmount: true } }),
    (prisma as any).eventInvoice.aggregate({ where: { ...queryBase, status: { not: 'VOID' }, workflowStatus: { not: 'DRAFT' }, cityLedgerInvoice: null }, _count: { _all: true }, _sum: { totalAmount: true, paidAmount: true } }),
    (prisma as any).cityLedgerInvoice.aggregate({ where: { ...queryBase, status: { in: ['OPEN', 'PARTIALLY_PAID'] }, dueDate: { lt: scope.asOf }, outstandingAmount: { gt: 0 } }, _sum: { outstandingAmount: true }, _count: { _all: true } }),
    Promise.all([
      (prisma as any).folio.findMany({ where: queryBase, select: { currency: true }, distinct: ['currency'] }),
      (prisma as any).cityLedgerInvoice.findMany({ where: queryBase, select: { currency: true }, distinct: ['currency'] }),
      (prisma as any).eventInvoice.findMany({ where: queryBase, select: { currency: true }, distinct: ['currency'] }),
    ]),
  ]);
  const scoped = result.documents;
  const currencies = Array.from(new Set(currencyRows.flat().map((row: any) => row.currency)));
  const singleCurrency = resolveBillingMetricCurrency(currencies, scope.currency);
  const issuedCount = Number(folioAggregate._count?._all || 0) + Number(cityAggregate._count?._all || 0) + Number(eventAggregate._count?._all || 0);
  const totalInvoiced = sumDecimal([amount(folioAggregate._sum?.totalCharges), amount(cityAggregate._sum?.amount), amount(eventAggregate._sum?.totalAmount)]);
  const totalCollected = sumDecimal([amount(folioAggregate._sum?.totalPayments), amount(cityAggregate._sum?.paidAmount), amount(eventAggregate._sum?.paidAmount)]);
  const outstanding = sumSignedDecimal([amount(folioAggregate._sum?.balance), amount(cityAggregate._sum?.outstandingAmount), sumSignedDecimal([amount(eventAggregate._sum?.totalAmount), `-${amount(eventAggregate._sum?.paidAmount)}`])]);
  return {
    scope: result.scope,
    metrics: {
      invoiceCount: issuedCount,
      totalInvoiced: singleCurrency ? totalInvoiced : null,
      totalCollected: singleCurrency ? totalCollected : null,
      outstanding: singleCurrency ? outstanding : null,
      overdue: singleCurrency ? amount(overdueAggregate._sum?.outstandingAmount) : null,
      currency: singleCurrency,
      overdueBasis: 'CITY_LEDGER_DUE_DATE',
    },
    aging: ['CURRENT', '1_30', '31_60', '61_90', '90_PLUS'].map(bucket => ({ bucket, amount: null, count: 0, supported: false, basis: 'UNAVAILABLE', asOf: scope.asOf.toISOString(), eligibleSources: [] })),
    recentDocuments: scoped.slice(0, 8),
    exceptions: { unavailableAging: true, agingReason: 'No common authoritative due-date and balance contract exists across Folio, City Ledger and Event Invoice sources.', multiCurrency: currencies.length > 1, overdueCount: Number(overdueAggregate._count?._all || 0) },
  };
}

export async function getBillingDocument(scope: BillingScope, source: BillingSource, id: string) {
  if (source === 'FOLIO') {
    const row = await (prisma as any).folio.findFirst({ where: { id, propertyId: scope.propertyId }, include: { guest: true, corporateAccount: { select: { id: true, name: true } }, payments: true, credits: { include: { applications: true } }, refunds: true, items: { orderBy: { businessDate: 'desc' }, take: 50 } } });
    return row ? normalizeFolio(row, scope.ctx.organizationId, scope.asOf) : null;
  }
  if (source === 'CITY_LEDGER_INVOICE') {
    const row = await (prisma as any).cityLedgerInvoice.findFirst({ where: { id, propertyId: scope.propertyId }, include: { account: true, allocations: { include: { payment: true } }, entries: true } });
    return row ? normalizeCityInvoice(row, scope.ctx.organizationId, scope.asOf) : null;
  }
  const row = await (prisma as any).eventInvoice.findFirst({ where: { id, propertyId: scope.propertyId }, include: { event: { include: { guest: true, corporateAccount: { select: { id: true, name: true } } } }, leaseBillingSchedule: { select: { dueDate: true } }, items: true, payments: true, cityLedgerInvoice: { include: { allocations: true } } } });
  return row ? normalizeEventInvoice(row, scope.ctx.organizationId, scope.asOf) : null;
}

export async function getBillingDocumentHistory(scope: BillingScope, document: BillingDocument) {
  const sourceIds = [document.sourceId, ...document.related.paymentIds];
  const [payments, allocations, refunds, refundRequests, credits, journals, audit] = await Promise.all([
    document.related.paymentIds.length ? (prisma as any).payment.findMany({ where: { id: { in: document.related.paymentIds }, propertyId: scope.propertyId }, orderBy: { createdAt: 'desc' } }) : [],
    document.related.allocationIds.length ? (prisma as any).cityLedgerAllocation.findMany({ where: { id: { in: document.related.allocationIds }, payment: { propertyId: scope.propertyId } }, include: { payment: { select: { id: true, reference: true, amount: true, currency: true, status: true } } }, orderBy: { createdAt: 'desc' } }) : [],
    document.related.refundIds.length ? (prisma as any).refund.findMany({ where: { id: { in: document.related.refundIds }, propertyId: scope.propertyId }, orderBy: { createdAt: 'desc' } }) : [],
    document.related.paymentIds.length ? (prisma as any).refundRequest.findMany({ where: { propertyId: scope.propertyId, paymentId: { in: document.related.paymentIds } }, orderBy: { createdAt: 'desc' } }) : [],
    document.related.creditIds.length ? (prisma as any).folioCredit.findMany({ where: { id: { in: document.related.creditIds }, propertyId: scope.propertyId }, include: { applications: true }, orderBy: { createdAt: 'desc' } }) : [],
    (prisma as any).journalEntryLine.findMany({ where: { sourceId: { in: sourceIds }, entry: { propertyId: scope.propertyId } }, include: { entry: { select: { id: true, entryNumber: true, entryDate: true, description: true, reference: true, status: true, isReversed: true } }, account: { select: { code: true, name: true } } }, orderBy: { entry: { entryDate: 'desc' } }, take: 100 }),
    (prisma as any).auditLog.findMany({ where: { propertyId: scope.propertyId, resourceId: { in: sourceIds } }, select: { id: true, action: true, resource: true, resourceId: true, userEmail: true, userRole: true, createdAt: true, newValue: true }, orderBy: { createdAt: 'desc' }, take: 100 }),
  ]);
  return { payments, allocations, refunds, refundRequests, credits, journals, audit };
}

export { allocationState };
