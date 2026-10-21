import { describe, expect, it } from 'vitest';
import { canReadBilling, compareBillingRegisterEntries, decodeBillingCursor, encodeBillingCursor, normalizeCityInvoice, normalizeEventInvoice, normalizeFolio, resolveBillingMetricCurrency } from './billing-read-model';

const asOf = new Date('2026-10-21T00:00:00.000Z');

describe('Billing read-model source adapters', () => {
  it('normalizes a folio without treating its payment items as separate receipts', () => {
    const document = normalizeFolio({
      id: 'folio-1', propertyId: 'property-1', folioNumber: 'F-100', type: 'ROOM', status: 'OPEN', currency: 'NGN',
      totalCharges: '150000.0000', totalPayments: '50000.0000', balance: '100000.0000', createdAt: asOf,
      guest: { id: 'guest-1', firstName: 'Ada', lastName: 'Lovelace' }, payments: [{ id: 'payment-1' }], credits: [], refunds: [],
    }, 'org-1', asOf);
    expect(document).toMatchObject({ source: 'FOLIO', reference: 'F-100', customer: { kind: 'GUEST', name: 'Ada Lovelace' }, outstandingAmount: '100000.0000', settlementStatus: 'UNPAID' });
    expect(document.related.paymentIds).toEqual(['payment-1']);
  });

  it('keeps City Ledger due-date ageing separate from source status', () => {
    const document = normalizeCityInvoice({
      id: 'invoice-1', propertyId: 'property-1', invoiceNumber: 'CL-100', issueDate: new Date('2026-09-01'), dueDate: new Date('2026-10-01'),
      description: 'Corporate stay', amount: '200000', paidAmount: '50000', outstandingAmount: '150000', currency: 'NGN', status: 'PARTIALLY_PAID',
      account: { id: 'account-1', name: 'Acme Ltd' }, allocations: [{ id: 'allocation-1', paymentId: 'payment-2' }],
    }, 'org-1', asOf);
    expect(document.settlementStatus).toBe('OVERDUE');
    expect(document.workflowStatus).toBeUndefined();
    expect(document.related).toMatchObject({ allocationIds: ['allocation-1'], paymentIds: ['payment-2'] });
  });

  it('preserves Event Invoice workflow status and does not double-count a linked AR document', () => {
    const document = normalizeEventInvoice({
      id: 'event-invoice-1', propertyId: 'property-1', totalAmount: '300000', paidAmount: '100000', currency: 'NGN', status: 'PARTIAL', workflowStatus: 'ISSUED',
      createdAt: asOf, issuedAt: asOf, event: { id: 'event-1', name: 'Conference', guest: null, corporateAccount: { id: 'account-1', name: 'Acme Ltd' } }, payments: [{ id: 'payment-3' }],
    }, 'org-1', asOf);
    expect(document).toMatchObject({ source: 'EVENT_INVOICE', workflowStatus: 'ISSUED', sourceStatus: 'PARTIAL', settlementStatus: 'PARTIAL', outstandingAmount: '200000' });
    expect(document.related.paymentIds).toEqual(['payment-3']);
  });

  it('uses exact folio counters and excludes guest credits from receivables', () => {
    const document = normalizeFolio({
      id: 'folio-2', propertyId: 'property-1', folioNumber: 'F-101', type: 'ROOM', status: 'OPEN', currency: 'NGN',
      totalCharges: '100.10', totalPayments: '0', balance: '0', createdAt: asOf,
      guest: { id: 'guest-1', firstName: 'Ada', lastName: 'Lovelace' }, payments: [], credits: [{ id: 'credit-1' }], refunds: [],
    }, 'org-1', asOf);
    expect(document.outstandingAmount).toBe('100.1000');
    expect(document.related.creditIds).toEqual(['credit-1']);
  });

  it('does not choose a base currency when metrics contain multiple currencies', () => {
    expect(resolveBillingMetricCurrency(['NGN', 'USD'], 'NGN')).toBeNull();
    expect(resolveBillingMetricCurrency(['NGN'], 'NGN')).toBe('NGN');
  });

  it('limits billing visibility to verified financial roles', () => {
    expect(canReadBilling('ACCOUNTANT')).toBe(true);
    expect(canReadBilling('EXECUTIVE')).toBe(true);
    expect(canReadBilling('SUPER_ADMIN')).toBe(true);
    expect(canReadBilling('FRONT_DESK')).toBe(false);
  });

  it('uses source and ID tie-breakers for identical register timestamps', () => {
    const timestamp = new Date('2026-10-20T12:00:00.000Z');
    const folio = { sortDate: timestamp, source: 'FOLIO' as const, sourceId: 'z' };
    const city = { sortDate: timestamp, source: 'CITY_LEDGER_INVOICE' as const, sourceId: 'a' };
    const event = { sortDate: timestamp, source: 'EVENT_INVOICE' as const, sourceId: 'a' };
    expect(compareBillingRegisterEntries(folio, city)).toBeLessThan(0);
    expect(compareBillingRegisterEntries(city, event)).toBeLessThan(0);
    expect(compareBillingRegisterEntries({ ...event, sourceId: 'b' }, event)).toBeGreaterThan(0);
  });

  it('round-trips a versioned source-aware cursor', () => {
    const encoded = encodeBillingCursor({ sortDate: asOf.toISOString(), source: 'CITY_LEDGER_INVOICE', sourceId: 'invoice-1', filterKey: '{"source":null}' });
    expect(decodeBillingCursor(encoded)).toMatchObject({ version: 1, source: 'CITY_LEDGER_INVOICE', sourceId: 'invoice-1', sortDate: asOf.toISOString() });
    expect(decodeBillingCursor('not-a-cursor')).toBeNull();
  });
});
