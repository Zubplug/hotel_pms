import { GLMappingService } from '@/lib/services/gl-mapping-service';
import { GeneralLedgerService } from '@/lib/services/general-ledger-service';

/** Applies unused previous-stay guest credit to the current folio. */
export async function applyAvailableGuestLedgerCredit(
  tx: any,
  options: {
    folioId: string;
    propertyId: string;
    organizationId: string;
    guestId: string | null;
    reservationId: string;
    amount: number;
    currency: string;
    appliedBy: string;
    deviceId?: string | null;
    operationKey: string;
    businessDate: Date;
    description: string;
  },
) {
  if (!options.guestId || options.amount <= 0) return 0;

  const entries = await tx.cityLedgerEntry.findMany({
    where: { guestId: options.guestId, propertyId: options.propertyId, type: 'REFUND_OWED', status: 'OPEN' },
    include: { allocations: { select: { amount: true } } },
    orderBy: { createdAt: 'asc' },
  });
  let remainingToApply = options.amount;
  let appliedTotal = 0;

  const guestLedgerAccountId = await GLMappingService.getGuestLedgerAccount(options.propertyId);
  const refundsPayableAccountId = await GLMappingService.getGuestRefundsPayableAccount(options.propertyId);

  for (const entry of entries) {
    if (remainingToApply <= 0.01) break;

    if (String(entry.currency || 'NGN').toUpperCase() !== String(options.currency || 'NGN').toUpperCase()) {
      throw new Error(`Currency mismatch. Credit=${entry.currency}, folio=${options.currency}`);
    }

    const applicationKey = `NIGHT_AUDIT_GUEST_CREDIT:${options.operationKey}:${entry.id}`;
    const existingApplication = await tx.folioItem.findFirst({
      where: { folioId: options.folioId, operationId: applicationKey, voidedAt: null },
      select: { amount: true },
    });
    if (existingApplication) {
      const alreadyApplied = Math.abs(Number(existingApplication.amount));
      appliedTotal += alreadyApplied;
      remainingToApply -= alreadyApplied;
      continue;
    }

    const allocated = entry.allocations.reduce((sum: number, allocation: any) => sum + Number(allocation.amount), 0);
    const available = Number(entry.amount) - allocated;
    if (available <= 0.01) continue;

    const applyNow = Math.min(available, remainingToApply);
    const allocation = await tx.cityLedgerAllocation.create({
      data: {
        paymentId: entry.id,
        folioId: options.folioId,
        amount: applyNow,
        currency: options.currency,
        createdBy: options.appliedBy,
      },
    });
    const remainingEntryCredit = available - applyNow;
    await tx.cityLedgerAccount.update({ where: { id: entry.accountId }, data: { balance: { decrement: applyNow } } });
    if (remainingEntryCredit <= 0.01) {
      await tx.cityLedgerEntry.update({ where: { id: entry.id }, data: { status: 'SETTLED' } });
    }

    await tx.folioItem.create({
      data: {
        folioId: options.folioId,
        businessDate: options.businessDate,
        type: 'PAYMENT',
        source: 'CITY_LEDGER',
        description: options.description,
        quantity: 1,
        unitAmount: -applyNow,
        amount: -applyNow,
        currency: options.currency,
        baseAmount: -applyNow,
        postedBy: options.appliedBy,
        operationId: applicationKey,
        reservationId: options.reservationId,
        guestId: options.guestId,
      },
    });
    await tx.folio.update({
      where: { id: options.folioId },
      data: { balance: { decrement: applyNow }, totalPayments: { increment: applyNow }, version: { increment: 1 } },
    });
    await GeneralLedgerService.postJournal(
      { userId: options.appliedBy, propertyIds: [options.propertyId], organizationId: options.organizationId, role: 'SYSTEM', permissions: [], outletIds: [] },
      {
        propertyId: options.propertyId,
        entryDate: options.businessDate,
        reference: applicationKey,
        description: 'Apply previous-stay guest credit during night audit',
        sourceModule: 'AR',
        lines: [
          { accountId: refundsPayableAccountId, debit: applyNow, credit: 0, description: 'Release guest refund payable', sourceType: 'GUEST_CREDIT_APPLICATION', sourceId: options.folioId },
          { accountId: guestLedgerAccountId, debit: 0, credit: applyNow, description: 'Apply guest credit to room folio', sourceType: 'GUEST_CREDIT_APPLICATION', sourceId: options.folioId },
        ],
      },
      tx,
    );
    await tx.financialAuditLog.create({
      data: {
        operationId: applicationKey,
        propertyId: options.propertyId,
        reservationId: options.reservationId,
        folioId: options.folioId,
        guestId: options.guestId,
        amount: applyNow,
        currency: options.currency,
        operatorId: options.appliedBy,
        deviceId: options.deviceId || null,
        businessDate: options.businessDate,
        operationType: 'GUEST_CREDIT_APPLICATION',
        reason: options.description,
        approvalStatus: 'NOT_REQUIRED',
        idempotencyKey: `audit:${applicationKey}`,
        metadata: { source: 'NIGHT_AUDIT', creditEntryId: entry.id, allocationId: allocation.id },
      },
    });

    appliedTotal += applyNow;
    remainingToApply -= applyNow;
  }

  return appliedTotal;
}
