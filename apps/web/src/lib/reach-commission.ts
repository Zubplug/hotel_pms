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
  // Referral earnings are based on eligible room revenue, not on whether the
  // property has collected payment. Payment collection is a property-side
  // responsibility and must not reduce the partner's commission.
  const basis = Math.max(0, input.eligibleRevenue);
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
    include: {
      campaign: true,
      program: true,
      commission: true,
      partner: { select: { isStaffReferrer: true } },
      roomType: true,
      reservation: { select: { checkIn: true, checkOut: true } },
    },
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
  const roomRule = booking.roomType;
  const stayNights = booking.reservation
    ? Math.max(1, Math.ceil((booking.reservation.checkOut.getTime() - booking.reservation.checkIn.getTime()) / (1000 * 60 * 60 * 24)))
    : 1;
  if (roomRule && !roomRule.referralEnabled) amounts.commission = 0;
  else if (roomRule && Number(roomRule.referralCommissionValue) > 0) {
    amounts.commission = roomRule.referralCommissionMode === 'AMOUNT'
      ? roundMoney(Number(roomRule.referralCommissionValue) * stayNights)
      // Room-type referral rules apply to the complete eligible stay. The
      // booking may be paid in instalments (for example, before and after an
      // extension), but the partner commission still covers every eligible
      // night in the booking.
      : roundMoney(Number(booking.eligibleRevenue) * Number(roomRule.referralCommissionValue) / 100);
  }
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
      // Reach commissions are approved automatically once the authoritative
      // checkout has been reconciled. The whole transaction rolls back if
      // accounting or wallet crediting fails.
      status: 'APPROVED',
      basisAmount: roomRule?.referralCommissionMode === 'PERCENT' && Number(roomRule.referralCommissionValue) > 0
        ? Number(booking.eligibleRevenue)
        : amounts.basis,
      rateBps: roomRule?.referralCommissionMode === 'AMOUNT' && Number(roomRule.referralCommissionValue) > 0
        ? 0
        : roomRule && Number(roomRule.referralCommissionValue) > 0
          ? Math.round(Number(roomRule.referralCommissionValue) * 100)
          : (booking.campaign?.commissionBps ?? 0),
      amount: amounts.commission,
      currency: booking.currency,
      earnedAt: now,
      approvedAt: now,
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

  // External partners are paid through Reach wallets. Staff referrers are
  // paid only through payroll, so never credit a wallet for their commission.
  // This prevents the same approved commission being paid twice.
  if (amounts.commission > 0 && !booking.partner.isStaffReferrer) {
    const wallet = await tx.referralPartnerWallet.upsert({
      where: { partnerId: booking.partnerId },
      update: {},
      create: { partnerId: booking.partnerId, currency: booking.currency },
    });
    await tx.$queryRaw`SELECT id FROM "ReferralPartnerWallet" WHERE id = ${wallet.id}::uuid FOR UPDATE`;
    const lockedWallet = await tx.referralPartnerWallet.findUniqueOrThrow({ where: { id: wallet.id } });
    const existingWalletCredit = await tx.referralPartnerWalletTransaction.findUnique({
      where: { idempotencyKey: `REACH_PARTNER_COMMISSION:${commission.id}` },
    });
    if (!existingWalletCredit) {
      const balance = Number(lockedWallet.availableBalance) + amounts.commission;
      await tx.referralPartnerWallet.update({
        where: { id: wallet.id },
        data: { availableBalance: balance, currency: booking.currency },
      });
      await tx.referralPartnerWalletTransaction.create({
        data: {
          walletId: wallet.id,
          partnerId: booking.partnerId,
          commissionId: commission.id,
          type: 'COMMISSION_CREDIT',
          status: 'COMPLETED',
          amount: amounts.commission,
          balanceAfter: balance,
          currency: booking.currency,
          idempotencyKey: `REACH_PARTNER_COMMISSION:${commission.id}`,
          metadata: { source: 'FULFILMENT', autoApproved: true },
          completedAt: now,
        },
      });
    }
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

  const originalBasis = Math.max(0, Number(booking.eligibleRevenue));
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

    // Claw back any amount that was already credited to the partner wallet.
    // A negative balance is intentional: it records a recoverable partner
    // debt when the commission has already been withdrawn or spent.
    const wallet = await tx.referralPartnerWallet.findUnique({ where: { partnerId: booking.partnerId } });
    if (wallet) {
      await tx.$queryRaw`SELECT id FROM "ReferralPartnerWallet" WHERE id = ${wallet.id}::uuid FOR UPDATE`;
      const walletCredit = await tx.referralPartnerWalletTransaction.findFirst({
        where: { commissionId: booking.commission.id, type: 'COMMISSION_CREDIT', status: 'COMPLETED' },
        select: { id: true },
      });
      const walletReversalKey = `${input.idempotencyKey}:wallet`;
      const existingWalletReversal = await tx.referralPartnerWalletTransaction.findUnique({ where: { idempotencyKey: walletReversalKey }, select: { id: true } });
      if (walletCredit && !existingWalletReversal) {
        const lockedWallet = await tx.referralPartnerWallet.findUniqueOrThrow({ where: { id: wallet.id } });
        const balance = Math.round((Number(lockedWallet.availableBalance) - commissionReversal) * 100) / 100;
        await tx.referralPartnerWallet.update({ where: { id: wallet.id }, data: { availableBalance: balance } });
        await tx.referralPartnerWalletTransaction.create({
          data: {
            walletId: wallet.id,
            partnerId: booking.partnerId,
            commissionId: booking.commission.id,
            type: 'ADJUSTMENT',
            status: 'COMPLETED',
            amount: -commissionReversal,
            balanceAfter: balance,
            currency: booking.currency,
            idempotencyKey: walletReversalKey,
            metadata: { source: 'REFUND_OR_CANCELLATION', reason: input.reason, refundedRevenue: refundBasis },
            completedAt: now,
          },
        });
      }
    }
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
  input: { reservationId?: string | null; refundedRevenue: number; idempotencyKey: string; reason: string; actorId: string; now?: Date },
) {
  if (!input.reservationId) return null;
  const booking = await tx.referralBooking.findFirst({
    where: { reservationId: input.reservationId, commission: { isNot: null } },
    select: { id: true },
  });
  if (!booking) return null;
  return reverseReachBooking(tx, { referralBookingId: booking.id, refundedRevenue: input.refundedRevenue, idempotencyKey: input.idempotencyKey, reason: input.reason, actorId: input.actorId, now: input.now });
}
