export async function applyAvailableFolioCredit(
  tx: any,
  options: {
    folioId: string;
    propertyId: string;
    guestId?: string | null;
    reservationId?: string | null;
    amount: number;
    currency: string;
    source: string;
    description: string;
    appliedBy: string;
    deviceId?: string | null;
    operationKey: string;
    businessDate: Date;
  }
) {
  let appliedTotal = 0;
  const credits = await tx.folioCredit.findMany({
    where: {
      folioId: options.folioId,
      propertyId: options.propertyId,
      status: { in: ['AVAILABLE', 'PARTIALLY_APPLIED'] },
      remainingAmount: { gt: 0 }
    },
    orderBy: { createdAt: 'asc' }
  });

  for (const credit of credits) {
    if (appliedTotal >= options.amount) break;
    const applied = Math.min(options.amount - appliedTotal, Number(credit.remainingAmount));
    if (applied <= 0) continue;

    const updatedCredit = await tx.folioCredit.updateMany({
      where: { id: credit.id, remainingAmount: { gte: applied } },
      data: {
        remainingAmount: { decrement: applied },
        status: applied >= Number(credit.remainingAmount) ? 'EXHAUSTED' : 'PARTIALLY_APPLIED'
      }
    });
    if (updatedCredit.count !== 1) continue;

    const applicationKey = `CREDIT_APPLICATION:${options.operationKey}:${credit.id}`;
    const application = await tx.folioCreditApplication.create({
      data: {
        creditId: credit.id,
        folioId: options.folioId,
        amount: applied,
        currency: options.currency,
        source: options.source,
        description: options.description,
        idempotencyKey: applicationKey,
        appliedBy: options.appliedBy,
        deviceId: options.deviceId,
        businessDate: options.businessDate
      }
    });

    await tx.folio.update({
      where: { id: options.folioId },
      data: { balance: { decrement: applied } }
    });

    await tx.financialAuditLog.create({
      data: {
        operationId: applicationKey,
        propertyId: options.propertyId,
        reservationId: options.reservationId,
        folioId: options.folioId,
        guestId: options.guestId,
        creditId: credit.id,
        creditApplicationId: application.id,
        operationType: 'CREDIT_APPLICATION',
        amount: applied,
        currency: options.currency,
        operatorId: options.appliedBy,
        deviceId: options.deviceId,
        businessDate: options.businessDate,
        reason: options.description,
        approvalStatus: 'NOT_REQUIRED',
        idempotencyKey: `audit:${applicationKey}`,
        metadata: { source: options.source }
      }
    });
    appliedTotal += applied;
  }

  return appliedTotal;
}
