import { describe, expect, it } from 'vitest';
import { normalizeReceiptReference, resolvePaymentEntryReference } from './receivables-read-model';

describe('Receivables reference integrity', () => {
  it('normalizes case and whitespace consistently', () => {
    expect(normalizeReceiptReference('  rcpt-100  /  bank  ')).toBe('RCPT-100 / BANK');
  });

  it('surfaces missing references instead of guessing a City Ledger entry', () => {
    expect(resolvePaymentEntryReference({}, [{ id: 'entry-1', reference: 'RCPT-100' }])).toMatchObject({ status: 'MISSING_REFERENCE', entryIds: [] });
  });

  it('rejects malformed references', () => {
    expect(resolvePaymentEntryReference({ reference: 'RCPT-\u0000-100' }, [])).toMatchObject({ status: 'MALFORMED_REFERENCE' });
  });

  it('resolves exactly one normalized entry', () => {
    expect(resolvePaymentEntryReference({ reference: ' rcpt-100 ' }, [{ id: 'entry-1', reference: 'RCPT-100' }])).toMatchObject({ status: 'RESOLVED', entryIds: ['entry-1'], normalizedReference: 'RCPT-100' });
  });

  it('surfaces ambiguous duplicate references', () => {
    expect(resolvePaymentEntryReference({ reference: 'RCPT-100' }, [{ id: 'entry-1', reference: 'RCPT-100' }, { id: 'entry-2', reference: ' rcpt-100 ' }])).toMatchObject({ status: 'AMBIGUOUS_REFERENCE', entryIds: ['entry-1', 'entry-2'] });
  });

  it('does not silently choose when reference and receipt number point to different entries', () => {
    expect(resolvePaymentEntryReference({ reference: 'BANK-100', receiptNumber: 'RCPT-100' }, [{ id: 'entry-1', reference: 'BANK-100' }, { id: 'entry-2', reference: 'RCPT-100' }])).toMatchObject({ status: 'AMBIGUOUS_REFERENCE' });
  });
});
