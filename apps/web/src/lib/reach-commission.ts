import type { Prisma } from '@hotel-pms/db';
import { postReachAccrual, postReachReversal } from './reach-accounting';

type ReachTx = Prisma.TransactionClient;

export function calculateReachAmounts(input: {
  eligibleRevenue: number;
  collectedRevenue: number;
  commissionBps: number;
  platformFeeBps: number;
  platformFeeCap?: number | null;
}) {
  const basis = Math.max(0, Math.min(input.eligibleRevenue, input.collectedRevenue));
  const commission = roundMoney(basis * Math.max(0, input.commissionBps) / 10_000);
  const uncappedPlatformFee = roundMoney(basis * Math.max(0, input.platformFeeBps) / 10_000);
  const platformFee = input.platformFeeCap == null
    ? uncappedPlatformFee
    : Math.min(uncappedPlatformFee, Math.max(0, input.platformFeeCap));
  return { basis, commission, platformFee };
}

function roundMoney(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

export function calculateReachReversal(input: {
  originalBasis: number;
  refundedRevenue: number;
  commissionAmount: number;
  reversedCommissionAmount?: number;
  platformFeeAmount: number;
  reversedPlatformFeeAmount?: number;
}) {
  const basis = Math.max(0, input.originalBasis);
  const refundBasis = Math.min(basis, Math.max(0, input.refundedRevenue));
  const commissionRemaining = Math.max(0, input.commissionAmount - (input.reversedCommissionAmount ?? 0));
  const platformFeeRemaining = Math.max(0, input.platformFeeAmount - (input.reversedPlatformFeeAmount ?? 0));
  return {
    refundBasis,
    commissionReversal: Math.min(commissionRemaining, roundMoney(basis > 0 ? input.commissionAmount * refundBasis / basis : 0)),
    platformFeeReversal: Math.min(platformFeeRemaining, roundMoney(basis > 0 ? input.platformFeeAmount * refundBasis / basis : 0)),
  };
}

/**
 * Marks a referral booking fulfilled and creates its commission/platform fee
 * exactly once. Call this from a transaction after PMS fulfilment evidence is
 * available; booking confirmation or payment webhooks alone are insufficient.
 */
export async function fulfilReachBooking(
  tx: ReachTx,
  input: { referralBookingId: string; collectedRevenue: number; actorId: string; now?: Date },
) {
  const now = input.now ?? new Date();
  // Serialize fulfilment per referral booking. This protects the unique
  // commission/platform-fee rows when checkout and a later reconciliation
  // attempt arrive concurrently.
  await tx.$queryRaw`SELECT id FROM "ReferralBooking" WHERE id = ${input.referralBookingId}::uuid FOR UPDATE`;
  const booking = await tx.referralBooking.findUnique({
    where: { id: input.referralBookingId },
    include: { campaign: true, program: true, commission: true },
  });
  if (!booking) throw new Error('Reach booking not found');
  if (booking.commission) return booking.commission;
  if (booking.status === 'CANCELLED' || booking.status === 'REFUNDED') throw new Error('Cancelled or refunded Reach bookings cannot be fulfilled');

  const amounts = calculateReachAmounts({
    eligibleRevenue: Number(booking.eligibleRevenue),
    collectedRevenue: input.collectedRevenue,
    commissionBps: booking.campaign?.commissionBps ?? 0,
    platformFeeBps: booking.program.platformFeeBps,
    platformFeeCap: booking.program.platformFeeCap == null ? null : Number(booking.program.platformFeeCap),
  });
  const fulfilled = await tx.referralBooking.update({
    where: { id: booking.id },
    data: { status: 'FULFILLED', collectedRevenue: input.collectedRevenue, fulfilledAt: now },
  });
  const commission = await tx.referralCommission.create({
    data: {
      organizationId: booking.organizationId,
      propertyId: booking.propertyId,
      programId: booking.programId,
      partnerId: booking.partnerId,
      referralBookingId: fulfilled.id,
      status: 'PENDING',
      basisAmount: amounts.basis,
      rateBps: booking.campaign?.commissionBps ?? 0,
      amount: amounts.commission,
      currency: booking.currency,
      earnedAt: now,
    },
  });
  await tx.referralLedgerEntry.create({
    data: {
      organizationId: booking.organizationId,
      partnerId: booking.partnerId,
      commissionId: commission.id,
      entryType: 'COMMISSION',
      amount: amounts.commission,
      idempotencyKey: `REACH_COMMISSION:${booking.id}`,
      metadata: { basis: amounts.basis, source: 'FULFILMENT' },
    },
  });
  await tx.referralPlatformFee.create({
    data: {
      organizationId: booking.organizationId,
      propertyId: booking.propertyId,
      programId: booking.programId,
      referralBookingId: booking.id,
      basisAmount: amounts.basis,
      rateBps: booking.program.platformFeeBps,
      amount: amounts.platformFee,
      outstandingAmount: amounts.platformFee,
      status: 'EARNED',
    },
  });
  const platformFee = await tx.referralPlatformFee.findUnique({ where: { referralBookingId: booking.id } });
  const accounting = await postReachAccrual({
    tx,
    propertyId: booking.propertyId,
    organizationId: booking.organizationId,
    commissionId: commission.id,
    commissionAmount: amounts.commission,
    platformFeeId: platformFee?.id,
    platformFeeAmount: amounts.platformFee,
    actorId: input.actorId,
    entryDate: now,
  });
  if (accounting.commissionJournalId) {
    await tx.referralLedgerEntry.update({
      where: { idempotencyKey: `REACH_COMMISSION:${booking.id}` },
      data: { journalEntryId: accounting.commissionJournalId },
    });
  }
  return commission;
}

/**
 * Records an auditable commission/platform-fee reversal after a cancellation
 * or refund. Original earned amounts are never edited; only cumulative
 * reversal totals are updated and a negative partner ledger entry is added.
 */
export async function reverseReachBooking(
  tx: ReachTx,
  input: {
    referralBookingId: string;
    refundedRevenue: number;
    idempotencyKey: string;
    reason: string;
    actorId: string;
    now?: Date;
  },
) {
  const now = input.now ?? new Date();
  await tx.$queryRaw`SELECT id FROM "ReferralBooking" WHERE id = ${input.referralBookingId}::uuid FOR UPDATE`;
  const booking = await tx.referralBooking.findUnique({
    where: { id: input.referralBookingId },
    include: { commission: true, platformFee: true },
  });
  if (!booking?.commission) return null;

  const originalBasis = Math.min(Number(booking.eligibleRevenue), Number(booking.collectedRevenue));
  const reversal = calculateReachReversal({
    originalBasis,
    refundedRevenue: input.refundedRevenue,
    commissionAmount: Number(booking.commission.amount),
    reversedCommissionAmount: Number(booking.commission.reversedAmount),
    platformFeeAmount: Number(booking.platformFee?.amount || 0),
    reversedPlatformFeeAmount: Number(booking.platformFee?.reversedAmount || 0),
  });
  const { refundBasis, commissionReversal } = reversal;
  if (commissionReversal > 0) {
    await tx.referralLedgerEntry.create({
      data: {
        organizationId: booking.organizationId,
        partnerId: booking.partnerId,
        commissionId: booking.commission.id,
        entryType: 'REVERSAL',
        amount: -commissionReversal,
        currency: booking.currency,
        idempotencyKey: input.idempotencyKey,
        metadata: { reason: input.reason, refundedRevenue: refundBasis, source: 'REFUND_OR_CANCELLATION' },
      },
    });
    const newReversed = Number(booking.commission.reversedAmount) + commissionReversal;
    await tx.referralCommission.update({
      where: { id: booking.commission.id },
      data: { reversedAmount: newReversed, status: newReversed >= Number(booking.commission.amount) ? 'REVERSED' : 'ON_HOLD' },
    });
  }

  if (booking.platformFee && originalBasis > 0) {
    const feeReversal = reversal.platformFeeReversal;
    if (feeReversal > 0) {
      const newReversed = Number(booking.platformFee.reversedAmount) + feeReversal;
      await tx.referralPlatformFee.update({
        where: { id: booking.platformFee.id },
        data: { reversedAmount: newReversed, status: newReversed >= Number(booking.platformFee.amount) ? 'REVERSED' : 'REVERSED' },
      });
    }
  }

  const accounting = await postReachReversal({
    tx,
    propertyId: booking.propertyId,
    organizationId: booking.organizationId,
    actorId: input.actorId,
    entryDate: now,
    commissionId: booking.commission.id,
    commissionAmount: commissionReversal,
    platformFeeId: booking.platformFee?.id,
    platformFeeAmount: reversal.platformFeeReversal,
    idempotencyKey: input.idempotencyKey,
  });
  if (accounting.commissionJournalId) {
    await tx.referralLedgerEntry.update({
      where: { idempotencyKey: input.idempotencyKey },
      data: { journalEntryId: accounting.commissionJournalId },
    });
  }

  const fullyRefunded = refundBasis >= originalBasis - 0.01;
  await tx.referralBooking.update({
    where: { id: booking.id },
    data: {
      status: fullyRefunded ? 'REFUNDED' : booking.status,
      collectedRevenue: { decrement: refundBasis },
    },
  });
  return { commissionReversal, fullyRefunded, reversedAt: now };
}

export async function reverseReachReservation(
  tx: ReachTx,
  input: { reservationId?: string | null; refundedRevenue: number; idempotencyKey: string; reason: string; now?: Date },
) {
  if (!input.reservationId) return null;
  const booking = await tx.referralBooking.findFirst({
    where: { reservationId: input.reservationId, commission: { isNot: null } },
    select: { id: true },
  });
  if (!booking) return null;
  return reverseReachBooking(tx, { referralBookingId: booking.id, refundedRevenue: input.refundedRevenue, idempotencyKey: input.idempotencyKey, reason: input.reason, actorId: input.actorId, now: input.now });
}
