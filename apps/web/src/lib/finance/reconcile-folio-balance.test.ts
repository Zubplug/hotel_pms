import { describe, expect, it, vi } from 'vitest';
import { reconcileFolioBalanceFromCounters } from './reconcile-folio-balance';

describe('reconcileFolioBalanceFromCounters', () => {
  it('repairs a stale balance when payment arrived before the room charge', async () => {
    const update = vi.fn();
    const tx = {
      folio: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'folio-1',
          totalCharges: '35000.0000',
          totalPayments: '35000.0000',
          balance: '35000.0000',
        }),
        update,
      },
      folioCreditApplication: {
        count: vi.fn().mockResolvedValue(0),
      },
    };

    const result = await reconcileFolioBalanceFromCounters(tx, 'folio-1');

    expect(result?.toString()).toBe('0');
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][0].where).toEqual({ id: 'folio-1' });
    expect(update.mock.calls[0][0].data.balance.toString()).toBe('0');
    expect(update.mock.calls[0][0].data.version).toEqual({ increment: 1 });
  });

  it('does not write when the cached balance is already correct', async () => {
    const update = vi.fn();
    const tx = {
      folio: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'folio-1',
          totalCharges: '70000.0000',
          totalPayments: '35000.0000',
          balance: '35000.0000',
        }),
        update,
      },
      folioCreditApplication: {
        count: vi.fn().mockResolvedValue(0),
      },
    };

    await reconcileFolioBalanceFromCounters(tx, 'folio-1');

    expect(update).not.toHaveBeenCalled();
  });
});
