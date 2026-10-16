import crypto from 'node:crypto';
import type { Prisma } from '@hotel-pms/db';

type ReachTx = Prisma.TransactionClient;

export async function recordReachClick(
  db: any,
  input: { propertyId: string; campaignCode: string; landingPath?: string | null; now?: Date },
) {
  const now = input.now ?? new Date();
  const campaign = await db.referralCampaign.findFirst({
    where: {
      propertyId: input.propertyId,
      code: input.campaignCode,
      isActive: true,
      program: { enabled: true },
      partner: { status: 'ACTIVE', verificationStatus: 'VERIFIED' },
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    select: {
      id: true,
      code: true,
      partnerId: true,
      propertyId: true,
      organizationId: true,
      programId: true,
      targetUrl: true,
      program: { select: { attributionWindowDays: true } },
    },
  });
  if (!campaign) return null;

  const referralToken = crypto.randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + campaign.program.attributionWindowDays * 86_400_000);
  const click = await db.referralClick.create({
    data: {
      organizationId: campaign.organizationId,
      propertyId: campaign.propertyId,
      programId: campaign.programId,
      campaignId: campaign.id,
      partnerId: campaign.partnerId,
      referralToken,
      landingPath: input.landingPath ?? null,
      occurredAt: now,
      expiresAt,
    },
    select: { referralToken: true, expiresAt: true },
  });

  return { ...click, campaignCode: campaign.code, targetUrl: campaign.targetUrl };
}

/**
 * Converts a verified click into a booking attribution inside the same
 * transaction that creates the LodgeCore reservation. No guest data is copied.
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
    include: { program: true, campaign: true, partner: true },
  });
  if (!click || click.propertyId !== input.propertyId || click.organizationId !== input.organizationId) return null;
  if (!click.program.enabled || click.expiresAt <= now || click.partner.status !== 'ACTIVE' || click.partner.verificationStatus !== 'VERIFIED') return null;

  const existing = await tx.referralAttribution.findUnique({
    where: { propertyId_bookingId: { propertyId: input.propertyId, bookingId: input.reservationId } },
    select: { id: true },
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
      referralCode: click.campaign?.code ?? null,
      bookingId: input.reservationId,
      expiresAt: click.expiresAt,
      status: 'CONVERTED',
      convertedAt: now,
    },
    select: { id: true },
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
      eligibleRevenue: input.eligibleRevenue,
      collectedRevenue: 0,
      currency: input.currency,
      status: 'BOOKED',
    },
  });

  return attribution;
}
