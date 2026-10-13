/**
 * Canonical signed guest-folio position.
 * Positive means debit/debt, zero means settled, and negative means genuine
 * guest credit. The persisted balance is a cache; counters repair stale cache
 * values at read boundaries.
 */
export type FolioBalanceSource = {
  balance?: number | string | null;
  totalCharges?: number | string | null;
  totalPayments?: number | string | null;
};

export function getFolioBalance(input: FolioBalanceSource) {
  const cached = Number(input.balance);
  const charges = Number(input.totalCharges);
  const payments = Number(input.totalPayments);
  const hasCounters = input.totalCharges != null && input.totalPayments != null
    && Number.isFinite(charges) && Number.isFinite(payments);
  const signedBalance = hasCounters
    ? Math.round((charges - payments) * 100) / 100
    : Number.isFinite(cached) ? cached : 0;

  return {
    signedBalance,
    debit: Math.max(0, signedBalance),
    credit: Math.max(0, -signedBalance),
    settled: Math.abs(signedBalance) <= 0.01,
    cacheWasStale: hasCounters && Number.isFinite(cached) && Math.abs(cached - signedBalance) > 0.01,
  };
}
