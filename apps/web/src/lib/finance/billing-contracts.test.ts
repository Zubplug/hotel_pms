import { describe, expect, it } from 'vitest';
import {
  allocationState,
  assertAllocationWithinAvailable,
  cityLedgerPaymentPolicy,
  decimalDifference,
  decimalIsZero,
  folioPaymentPolicy,
  reconciliationState,
  sumDecimal,
  sumSignedDecimal,
} from './billing-contracts';

describe('Billing Phase 1 financial contracts', () => {
  it('uses exact decimal arithmetic for allocation totals', () => {
    expect(sumDecimal(['0.1', '0.2', '100000.1250'])).toBe('100000.425');
    expect(sumSignedDecimal(['100.10', '-0.10', '2.25'])).toBe('102.25');
  });

  it('supports signed ledger aggregates without weakening allocation validation', () => {
    expect(sumDecimal(['-726500', '100000'])).toBe('-626500');
    expect(() => assertAllocationWithinAvailable({
      receiptAmount: '100',
      existingAllocations: ['-10'],
      requestedAmount: '10',
    })).toThrow('Invalid non-negative decimal: -10');
  });

  it('rejects allocation beyond the receipt available balance', () => {
    expect(() => assertAllocationWithinAvailable({
      receiptAmount: '100000.00',
      existingAllocations: ['60000.00'],
      requestedAmount: '40000.01',
    })).toThrow('ALLOCATION_EXCEEDS_RECEIPT');
  });

  it('rejects allocation beyond the invoice outstanding balance', () => {
    expect(() => assertAllocationWithinAvailable({
      receiptAmount: '200000.00',
      existingAllocations: [],
      requestedAmount: '100000.01',
      invoiceOutstanding: '100000.00',
    })).toThrow('ALLOCATION_EXCEEDS_INVOICE');
  });

  it('classifies unapplied, partial, and fully allocated receipts', () => {
    expect(allocationState('100', [])).toBe('UNALLOCATED');
    expect(allocationState('100', ['40'])).toBe('PARTIAL');
    expect(allocationState('100', ['40', '60'])).toBe('FULL');
  });

  it('keeps folio overpayment rules distinct from City Ledger advances', () => {
    expect(folioPaymentPolicy('100.01', '100')).toBe('REJECT_OVERPAYMENT');
    expect(folioPaymentPolicy('100', '100')).toBe('ACCEPT');
    expect(cityLedgerPaymentPolicy('100.01', '100')).toBe('ACCEPT_APPLIED_OR_ADVANCE');
  });

  it('does not infer reconciliation from posting status', () => {
    expect(reconciliationState({ postingStatus: 'POSTED', externalMatch: 'NONE' })).toBe('POSTED_UNRECONCILED');
    expect(reconciliationState({ postingStatus: 'POSTED', externalMatch: 'MATCHED' })).toBe('MATCHED');
    expect(reconciliationState({ postingStatus: 'PENDING', externalMatch: 'EXCEPTION' })).toBe('EXCEPTION');
  });

  it('uses exact four-decimal reconciliation comparisons without a tolerance', () => {
    expect(decimalDifference('100.0050', '100.005')).toBe('0');
    expect(decimalIsZero(decimalDifference('100.0050', '100.005'))).toBe(true);
    expect(decimalDifference('100.0051', '100.005')).toBe('0.0001');
    expect(decimalIsZero(decimalDifference('100.0051', '100.005'))).toBe(false);
    expect(decimalDifference('-954757.46', '-726500')).toBe('-228257.46');
    expect(decimalDifference('-726500', '-726500')).toBe('0');
  });
});
