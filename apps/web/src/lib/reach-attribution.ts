import type { Prisma } from '@hotel-pms/db';

type ReachTx = Prisma.TransactionClient;

/**
 * Converts an offline/front-desk referral token into the same Reach records
 * used by the public Booking Engine. The token is treated as untrusted input;
 * all ownership, expiry, program, partner, and property checks happen here.
 */
export async function attributeReachReservation(
  tx: ReachTx,
  input: {
    referralToken?: string | null;
    reservationId: string;
    propertyId: string;
    organizationId: string;
    eligibleRevenue: number;
    currency: string;
    now?: Date;
  },
) {
  if (!input.referralToken) return null;
  const now = input.now ?? new Date();
  const click = await tx.referralClick.findUnique({
    where: { referralToken: input.referralToken },
    include: { program: true, partner: true, campaign: true },
  });
  if (!click || click.organizationId !== input.organizationId || click.propertyId !== input.propertyId) return null;
  if (click.expiresAt <= now || !click.program.enabled || click.partner.status !== 'ACTIVE' || click.partner.verificationStatus !== 'VERIFIED') return null;
  if (click.campaign && (!click.campaign.isActive || click.campaign.propertyId !== input.propertyId)) return null;

  const existing = await tx.referralAttribution.findUnique({
    where: { propertyId_bookingId: { propertyId: input.propertyId, bookingId: input.reservationId } },
  });
  if (existing) return existing;

  const attribution = await tx.referralAttribution.create({
    data: {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      programId: click.programId,
      partnerId: click.partnerId,
      campaignId: click.campaignId,
      clickId: click.id,
      referralCode: click.campaign?.code,
      bookingId: input.reservationId,
      status: 'CONVERTED',
      qualifiedAt: click.occurredAt,
      expiresAt: click.expiresAt,
      convertedAt: now,
      metadata: { source: 'OFFLINE_FRONT_DESK' },
    },
  });
  await tx.referralBooking.create({
    data: {
      organizationId: input.organizationId,
      propertyId: input.propertyId,
      programId: click.programId,
      partnerId: click.partnerId,
      campaignId: click.campaignId,
      attributionId: attribution.id,
      reservationId: input.reservationId,
      category: click.campaign?.category ?? 'STAY',
      eligibleRevenue: Math.max(0, input.eligibleRevenue),
      currency: input.currency || 'NGN',
    },
  });
  return attribution;
}
