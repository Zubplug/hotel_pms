import { describe, expect, it } from 'vitest';
import { getFolioBalance } from './folio-balance';

describe('getFolioBalance', () => {
  it('classifies a real debit from charges greater than payments', () => {
    expect(getFolioBalance({ balance: -140000, totalCharges: 200000, totalPayments: 60000 })).toMatchObject({
      signedBalance: 140000,
      debit: 140000,
      credit: 0,
      settled: false,
      cacheWasStale: true,
    });
  });

  it('treats equal charges and payments as settled despite a stale cache', () => {
    expect(getFolioBalance({ balance: -140000, totalCharges: 140000, totalPayments: 140000 })).toMatchObject({
      signedBalance: 0,
      debit: 0,
      credit: 0,
      settled: true,
      cacheWasStale: true,
    });
  });

  it('classifies an actual overpayment as guest credit', () => {
    expect(getFolioBalance({ balance: 0, totalCharges: 140000, totalPayments: 150000 })).toMatchObject({
      signedBalance: -10000,
      debit: 0,
      credit: 10000,
      settled: false,
    });
  });
});
