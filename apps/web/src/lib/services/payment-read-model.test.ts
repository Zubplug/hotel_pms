import { describe, expect, it } from 'vitest';
import { decodePaymentCursor, encodePaymentCursor, normalizePayment } from './payment-read-model';

const basePayment = {
  id: 'payment-1', receiptNumber: 'RCPT-1', reference: 'bank-ref-1', propertyId: 'property-1', currency: 'NGN', amount: '100.0000', baseAmount: '100.0000',
  method: 'BANK_TRANSFER', collectionSource: 'RECEIVABLES', status: 'COMPLETED', verificationStatus: 'UNVERIFIED', folioId: 'folio-1', eventInvoiceId: null,
  businessDate: new Date('2026-10-21'), createdAt: new Date('2026-10-21T10:00:00Z'), updatedAt: new Date('2026-10-21T10:00:00Z'),
  folio: { guest: { firstName: 'Ada', lastName: 'Lovelace' }, corporateAccount: null }, eventInvoice: null, frontdeskSession: null,
};

describe('Payment read-model normalization', () => {
  it('uses Payment.id once while representing corporate allocation and unapplied balance separately', () => {
    const payment = normalizePayment(basePayment, [{ id: 'entry-1', reference: 'RCPT-1', amount: '100', status: 'SETTLED' }], [{ id: 'allocation-1', paymentId: 'entry-1', amount: '60' }], [{ sourceId: 'payment-1', entry: { status: 'POSTED', isReversed: false } }], [], [], []);
    expect(payment.paymentId).toBe('payment-1');
    expect(payment.source.cityLedgerEntryIds).toEqual(['entry-1']);
    expect(payment.allocationStatus).toBe('PARTIAL');
    expect(payment.allocatedAmount).toBe('60');
    expect(payment.unappliedAmount).toBe('40');
    expect(payment.postingStatus).toBe('POSTED');
  });

  it('does not infer reconciliation from completed payment or posted journal status', () => {
    const payment = normalizePayment({ ...basePayment, collectionSource: 'FRONT_DESK', method: 'CARD' }, [], [], [{ sourceId: 'payment-1', entry: { status: 'POSTED', isReversed: false } }], [], [], []);
    expect(payment.processingStatus).toBe('COMPLETED');
    expect(payment.postingStatus).toBe('POSTED');
    expect(payment.reconciliationStatus).toBe('UNKNOWN');
  });

  it('keeps refund requests distinct from completed refunds and exposes exceptions', () => {
    const requested = normalizePayment(basePayment, [], [], [], [{ id: 'exception-1', status: 'OPEN' }], [{ id: 'request-1', status: 'PENDING_APPROVAL' }], []);
    expect(requested.refundStatus).toBe('REQUESTED');
    expect(requested.reconciliationStatus).toBe('EXCEPTION');
    expect(requested.reconciliationEvidence).toBe('TRANSACTION_EXCEPTION');
  });

  it('round-trips a filter-bound cursor', () => {
    const cursor = encodePaymentCursor({ createdAt: '2026-10-21T10:00:00.000Z', paymentId: 'payment-1', filterKey: '{"status":"COMPLETED"}' });
    expect(decodePaymentCursor(cursor)).toMatchObject({ version: 1, paymentId: 'payment-1', filterKey: '{"status":"COMPLETED"}' });
    expect(decodePaymentCursor('invalid')).toBeNull();
  });
});
