import { Prisma } from '@hotel-pms/db';

/**
 * Rebuilds the cached folio balance from the authoritative folio counters.
 *
 * totalCharges and totalPayments are already maintained by every supported
 * financial posting path. The balance column is a cache used by the online
 * and desktop clients, so it must be repaired whenever a posting can arrive
 * out of order (most importantly: an advance payment before night audit).
 *
 * This helper intentionally runs inside the caller's transaction. It does not
 * create a second payment or credit and is therefore safe to call on retries.
 */
export async function reconcileFolioBalanceFromCounters(
  tx: any,
  folioId: string,
) {
  const folio = await tx.folio.findUnique({
    where: { id: folioId },
    select: { id: true, totalCharges: true, totalPayments: true, balance: true },
  });
  if (!folio) return null;

  const expectedBalance = new Prisma.Decimal(folio.totalCharges)
    .minus(folio.totalPayments);
  const currentBalance = new Prisma.Decimal(folio.balance);

  if (!currentBalance.eq(expectedBalance)) {
    await tx.folio.update({
      where: { id: folio.id },
      data: { balance: expectedBalance, version: { increment: 1 } },
    });
  }

  return expectedBalance;
}
