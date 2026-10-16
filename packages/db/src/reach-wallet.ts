import type { Prisma } from '@prisma/client';

type ReachTx = Prisma.TransactionClient;

/**
 * Applies available wallet funds to the oldest unpaid Reach fees for an
 * organization. The transaction is deliberately data-only; callers post the
 * corresponding HQ journal entry in the same database transaction.
 */
export async function settleReachWallet(
  tx: ReachTx,
  input: { organizationId: string; currency?: string; now?: Date },
) {
  const now = input.now ?? new Date();
  const wallet = await tx.reachWallet.upsert({
    where: { organizationId: input.organizationId },
    create: { organizationId: input.organizationId, currency: input.currency ?? 'NGN' },
    update: {},
  });
  await tx.$queryRaw`SELECT id FROM "ReachWallet" WHERE id = ${wallet.id}::uuid FOR UPDATE`;
  let balance = Number((await tx.reachWallet.findUniqueOrThrow({ where: { id: wallet.id }, select: { balance: true, status: true } })).balance);
  if (balance <= 0 || wallet.status !== 'ACTIVE') return [];

  const fees = await tx.referralPlatformFee.findMany({
    where: { organizationId: input.organizationId, currency: input.currency ?? 'NGN', status: { not: 'REVERSED' }, outstandingAmount: { gt: 0 }, program: { walletAutoApply: true } },
    orderBy: { createdAt: 'asc' },
  });
  const allocations: Array<{ feeId: string; walletTransactionId: string; amount: number; propertyId: string }> = [];
  for (const fee of fees) {
    if (balance <= 0) break;
    const due = Math.max(0, Number(fee.outstandingAmount));
    const amount = Math.min(balance, due);
    if (amount <= 0) continue;
    const applied = Number(fee.walletAppliedAmount) + amount;
    const transaction = await tx.reachWalletTransaction.create({
      data: {
        walletId: wallet.id,
        organizationId: input.organizationId,
        propertyId: fee.propertyId,
        referralPlatformFeeId: fee.id,
        type: 'FEE_SETTLEMENT',
        status: 'COMPLETED',
        amount,
        currency: fee.currency,
        idempotencyKey: `REACH_WALLET_FEE:${fee.id}:${applied.toFixed(2)}`,
        description: 'Reach platform fee paid from customer wallet',
        completedAt: now,
      },
    });
    balance = Math.round((balance - amount) * 100) / 100;
    await tx.reachWallet.update({ where: { id: wallet.id }, data: { balance } });
    await tx.referralPlatformFee.update({ where: { id: fee.id }, data: { walletAppliedAmount: applied, outstandingAmount: { decrement: amount }, status: applied >= Number(fee.amount) - Number(fee.reversedAmount) - 0.01 ? 'INVOICED' : 'EARNED' } });
    allocations.push({ feeId: fee.id, walletTransactionId: transaction.id, amount, propertyId: fee.propertyId });
  }
  await refreshReachPropertyDebt(tx, input.organizationId, allocations.map((item) => item.propertyId), now);
  return allocations;
}

export async function refreshReachPropertyDebt(tx: ReachTx, organizationId: string, propertyIds: string[], now = new Date()) {
  const ids = Array.from(new Set(propertyIds));
  for (const propertyId of ids) {
    const [program, aggregate] = await Promise.all([
      tx.referralProgram.findUnique({ where: { propertyId }, select: { debtSuspensionThreshold: true } }),
      tx.referralPlatformFee.aggregate({ where: { organizationId, propertyId, status: { not: 'REVERSED' } }, _sum: { outstandingAmount: true } }),
    ]);
    const outstanding = Number(aggregate._sum.outstandingAmount || 0);
    const threshold = Number(program?.debtSuspensionThreshold || 50000);
    const suspended = outstanding >= threshold;
    await tx.reachPropertyDebt.upsert({
      where: { propertyId },
      create: { organizationId, propertyId, outstandingAmount: outstanding, suspensionThreshold: threshold, status: suspended ? 'SUSPENDED' : outstanding > 0 ? 'OVERDUE' : 'CLEARED', suspendedAt: suspended ? now : null, clearedAt: outstanding <= 0 ? now : null, lastEvaluatedAt: now },
      update: { outstandingAmount: outstanding, suspensionThreshold: threshold, status: suspended ? 'SUSPENDED' : outstanding > 0 ? 'OVERDUE' : 'CLEARED', suspendedAt: suspended ? undefined : null, clearedAt: outstanding <= 0 ? now : null, lastEvaluatedAt: now },
    });
    if (suspended) {
      await tx.property.updateMany({ where: { id: propertyId, organizationId }, data: { isActive: false, suspendedAt: now, suspensionReason: `Reach platform fee debt reached ${threshold.toFixed(2)}` } });
      await tx.entitlement.updateMany({ where: { organizationId, propertyId, status: 'ACTIVE' }, data: { status: 'SUSPENDED', suspendedAt: now, suspensionReason: 'Reach platform fee debt' } });
    } else if (outstanding <= 0) {
      await tx.property.updateMany({ where: { id: propertyId, organizationId, suspensionReason: { startsWith: 'Reach platform fee debt' } }, data: { isActive: true, suspendedAt: null, suspensionReason: null } });
      await tx.entitlement.updateMany({ where: { organizationId, propertyId, status: 'SUSPENDED', suspensionReason: 'Reach platform fee debt' }, data: { status: 'ACTIVE', suspendedAt: null, suspensionReason: null } });
    }
  }
}
