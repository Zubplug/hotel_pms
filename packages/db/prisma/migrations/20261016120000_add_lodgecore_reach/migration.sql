-- LodgeCore Reach: property-controlled referral attribution foundation.
-- This migration is additive. It does not alter reservations, payments,
-- subscriptions, or existing accounting ledgers.

CREATE TABLE IF NOT EXISTS "ReferralProgram" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "attributionWindowDays" INTEGER NOT NULL DEFAULT 30,
    "platformFeeBps" INTEGER NOT NULL DEFAULT 100,
    "platformFeeCap" DECIMAL(18,4),
    "minimumPayout" DECIMAL(18,4) NOT NULL DEFAULT 5000,
    "eligibleCategories" TEXT[] NOT NULL DEFAULT ARRAY['STAY']::TEXT[],
    "rules" JSONB,
    "activatedAt" TIMESTAMPTZ,
    "pausedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralProgram_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReferralPartner" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "verificationStatus" TEXT NOT NULL DEFAULT 'UNVERIFIED',
    "payoutProfile" JSONB,
    "termsAcceptedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralPartner_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReferralCampaign" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'STAY',
    "targetUrl" TEXT,
    "commissionBps" INTEGER NOT NULL DEFAULT 700,
    "budget" DECIMAL(18,4),
    "startsAt" TIMESTAMPTZ,
    "endsAt" TIMESTAMPTZ,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralCampaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReferralClick" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "campaignId" UUID,
    "partnerId" UUID NOT NULL,
    "referralToken" TEXT NOT NULL,
    "landingPath" TEXT,
    "occurredAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "metadata" JSONB,
    CONSTRAINT "ReferralClick_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReferralAttribution" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "campaignId" UUID,
    "clickId" UUID,
    "referralCode" TEXT,
    "bookingId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'QUALIFIED',
    "policyVersion" TEXT NOT NULL DEFAULT 'LAST_ELIGIBLE_V1',
    "qualifiedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "convertedAt" TIMESTAMPTZ,
    "metadata" JSONB,
    CONSTRAINT "ReferralAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReferralBooking" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "campaignId" UUID,
    "attributionId" UUID NOT NULL,
    "reservationId" UUID,
    "eventId" UUID,
    "category" TEXT NOT NULL DEFAULT 'STAY',
    "status" TEXT NOT NULL DEFAULT 'BOOKED',
    "eligibleRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "collectedRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "fulfilledAt" TIMESTAMPTZ,
    "cancelledAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralBooking_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReferralCommission" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "referralBookingId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "basisAmount" DECIMAL(18,4) NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "reversedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "accrualJournalEntryId" UUID,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "earnedAt" TIMESTAMPTZ,
    "approvedAt" TIMESTAMPTZ,
    "paidAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralCommission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReferralPayout" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "payoutReference" TEXT,
    "failureReason" TEXT,
    "settlementMethod" TEXT,
    "settlementAccountId" UUID,
    "journalEntryId" UUID,
    "processedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralPayout_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReferralLedgerEntry" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "partnerId" UUID,
    "commissionId" UUID,
    "payoutId" UUID,
    "entryType" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "journalEntryId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReferralPayoutItem" (
    "id" UUID NOT NULL,
    "payoutId" UUID NOT NULL,
    "commissionId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    CONSTRAINT "ReferralPayoutItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReferralPlatformFee" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "referralBookingId" UUID NOT NULL,
    "basisAmount" DECIMAL(18,4) NOT NULL,
    "rateBps" INTEGER NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "reversedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "hqJournalEntryId" UUID,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" TEXT NOT NULL DEFAULT 'EARNED',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralPlatformFee_pkey" PRIMARY KEY ("id")
);

-- Upgrade-safe additions for environments where an earlier Reach foundation
-- migration already created the original tables.
ALTER TABLE "ReferralCommission" ADD COLUMN IF NOT EXISTS "reversedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "ReferralCommission" ADD COLUMN IF NOT EXISTS "accrualJournalEntryId" UUID;
ALTER TABLE "ReferralLedgerEntry" ADD COLUMN IF NOT EXISTS "journalEntryId" UUID;
ALTER TABLE "ReferralProgram" ADD COLUMN IF NOT EXISTS "debtSuspensionThreshold" DECIMAL(18,4) NOT NULL DEFAULT 50000;
ALTER TABLE "ReferralProgram" ADD COLUMN IF NOT EXISTS "walletAutoApply" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "ReferralProgram" ADD COLUMN IF NOT EXISTS "activationFeeAmount" DECIMAL(18,4) NOT NULL DEFAULT 50000;
ALTER TABLE "ReferralProgram" ADD COLUMN IF NOT EXISTS "activationFeeCurrency" TEXT NOT NULL DEFAULT 'NGN';
ALTER TABLE "ReferralProgram" ADD COLUMN IF NOT EXISTS "activationPaymentStatus" TEXT NOT NULL DEFAULT 'NOT_PAID';
ALTER TABLE "ReferralProgram" ADD COLUMN IF NOT EXISTS "activationFeePaidAt" TIMESTAMPTZ;
UPDATE "ReferralProgram"
SET "activationPaymentStatus" = 'PAID', "activationFeePaidAt" = COALESCE("activatedAt", CURRENT_TIMESTAMP)
WHERE "enabled" = true AND "activationPaymentStatus" = 'NOT_PAID';
ALTER TABLE "ReferralPlatformFee" ADD COLUMN IF NOT EXISTS "reversedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "ReferralPlatformFee" ADD COLUMN IF NOT EXISTS "hqJournalEntryId" UUID;
ALTER TABLE "ReferralPlatformFee" ADD COLUMN IF NOT EXISTS "walletAppliedAmount" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "ReferralPlatformFee" ADD COLUMN IF NOT EXISTS "outstandingAmount" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "ReferralPlatformFee" ALTER COLUMN "outstandingAmount" SET DEFAULT 0;
UPDATE "ReferralPlatformFee"
SET "outstandingAmount" = GREATEST("amount" - "reversedAmount" - "walletAppliedAmount", 0)
WHERE "outstandingAmount" = 0 AND "status" <> 'REVERSED' AND "amount" > 0;
ALTER TABLE "ReferralPayout" ADD COLUMN IF NOT EXISTS "propertyId" UUID;
ALTER TABLE "ReferralPayout" ADD COLUMN IF NOT EXISTS "settlementMethod" TEXT;
ALTER TABLE "ReferralPayout" ADD COLUMN IF NOT EXISTS "settlementAccountId" UUID;
ALTER TABLE "ReferralPayout" ADD COLUMN IF NOT EXISTS "journalEntryId" UUID;
UPDATE "ReferralPayout" p
SET "propertyId" = c."propertyId"
FROM "ReferralPayoutItem" pi
JOIN "ReferralCommission" c ON c."id" = pi."commissionId"
WHERE pi."payoutId" = p."id" AND p."propertyId" IS NULL;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "ReferralPayout" WHERE "propertyId" IS NULL) THEN
    RAISE EXCEPTION 'Reach payout propertyId cannot be inferred from existing payout items';
  END IF;
  ALTER TABLE "ReferralPayout" ALTER COLUMN "propertyId" SET NOT NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralProgram_propertyId_key" ON "ReferralProgram"("propertyId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCampaign_code_key" ON "ReferralCampaign"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralClick_referralToken_key" ON "ReferralClick"("referralToken");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralAttribution_propertyId_bookingId_key" ON "ReferralAttribution"("propertyId", "bookingId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralBooking_attributionId_key" ON "ReferralBooking"("attributionId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralBooking_reservationId_key" ON "ReferralBooking"("reservationId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralBooking_eventId_key" ON "ReferralBooking"("eventId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralCommission_referralBookingId_key" ON "ReferralCommission"("referralBookingId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralLedgerEntry_idempotencyKey_key" ON "ReferralLedgerEntry"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPayoutItem_payoutId_commissionId_key" ON "ReferralPayoutItem"("payoutId", "commissionId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPlatformFee_referralBookingId_key" ON "ReferralPlatformFee"("referralBookingId");

CREATE INDEX IF NOT EXISTS "ReferralProgram_organizationId_enabled_idx" ON "ReferralProgram"("organizationId", "enabled");
CREATE INDEX IF NOT EXISTS "ReferralPartner_email_idx" ON "ReferralPartner"("email");
CREATE INDEX IF NOT EXISTS "ReferralPartner_status_verificationStatus_idx" ON "ReferralPartner"("status", "verificationStatus");
CREATE INDEX IF NOT EXISTS "ReferralCampaign_propertyId_isActive_idx" ON "ReferralCampaign"("propertyId", "isActive");
CREATE INDEX IF NOT EXISTS "ReferralCampaign_partnerId_isActive_idx" ON "ReferralCampaign"("partnerId", "isActive");
CREATE INDEX IF NOT EXISTS "ReferralClick_propertyId_occurredAt_idx" ON "ReferralClick"("propertyId", "occurredAt");
CREATE INDEX IF NOT EXISTS "ReferralClick_partnerId_occurredAt_idx" ON "ReferralClick"("partnerId", "occurredAt");
CREATE INDEX IF NOT EXISTS "ReferralAttribution_propertyId_status_expiresAt_idx" ON "ReferralAttribution"("propertyId", "status", "expiresAt");
CREATE INDEX IF NOT EXISTS "ReferralAttribution_partnerId_qualifiedAt_idx" ON "ReferralAttribution"("partnerId", "qualifiedAt");
CREATE INDEX IF NOT EXISTS "ReferralBooking_propertyId_status_createdAt_idx" ON "ReferralBooking"("propertyId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralBooking_partnerId_status_idx" ON "ReferralBooking"("partnerId", "status");
CREATE INDEX IF NOT EXISTS "ReferralCommission_propertyId_status_idx" ON "ReferralCommission"("propertyId", "status");
CREATE INDEX IF NOT EXISTS "ReferralCommission_partnerId_status_idx" ON "ReferralCommission"("partnerId", "status");
CREATE INDEX IF NOT EXISTS "ReferralLedgerEntry_partnerId_createdAt_idx" ON "ReferralLedgerEntry"("partnerId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralLedgerEntry_commissionId_createdAt_idx" ON "ReferralLedgerEntry"("commissionId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralPayout_partnerId_status_createdAt_idx" ON "ReferralPayout"("partnerId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralPlatformFee_propertyId_status_createdAt_idx" ON "ReferralPlatformFee"("propertyId", "status", "createdAt");

CREATE TABLE IF NOT EXISTS "ReferralActivationPayment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "programId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL DEFAULT 'FLUTTERWAVE',
    "providerReference" TEXT NOT NULL,
    "providerTransactionId" TEXT,
    "hqJournalEntryId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMPTZ,
    CONSTRAINT "ReferralActivationPayment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralActivationPayment_providerReference_key" ON "ReferralActivationPayment"("providerReference");
CREATE INDEX IF NOT EXISTS "ReferralActivationPayment_organizationId_status_idx" ON "ReferralActivationPayment"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "ReferralActivationPayment_propertyId_status_idx" ON "ReferralActivationPayment"("propertyId", "status");

-- Guard foreign keys so rerunning this migration against an earlier Reach
-- installation does not fail on already-existing constraints.
CREATE OR REPLACE FUNCTION pg_temp.add_reach_fk(p_constraint_name TEXT, p_statement TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = p_constraint_name) THEN
    EXECUTE p_statement;
  END IF;
END;
$$;

SELECT pg_temp.add_reach_fk('ReferralProgram_organizationId_fkey', 'ALTER TABLE "ReferralProgram" ADD CONSTRAINT "ReferralProgram_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralProgram_propertyId_fkey', 'ALTER TABLE "ReferralProgram" ADD CONSTRAINT "ReferralProgram_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralPartner_organizationId_fkey', 'ALTER TABLE "ReferralPartner" ADD CONSTRAINT "ReferralPartner_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralCampaign_organizationId_fkey', 'ALTER TABLE "ReferralCampaign" ADD CONSTRAINT "ReferralCampaign_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralCampaign_propertyId_fkey', 'ALTER TABLE "ReferralCampaign" ADD CONSTRAINT "ReferralCampaign_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralCampaign_programId_fkey', 'ALTER TABLE "ReferralCampaign" ADD CONSTRAINT "ReferralCampaign_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralCampaign_partnerId_fkey', 'ALTER TABLE "ReferralCampaign" ADD CONSTRAINT "ReferralCampaign_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralClick_organizationId_fkey', 'ALTER TABLE "ReferralClick" ADD CONSTRAINT "ReferralClick_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralClick_propertyId_fkey', 'ALTER TABLE "ReferralClick" ADD CONSTRAINT "ReferralClick_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralClick_programId_fkey', 'ALTER TABLE "ReferralClick" ADD CONSTRAINT "ReferralClick_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralClick_campaignId_fkey', 'ALTER TABLE "ReferralClick" ADD CONSTRAINT "ReferralClick_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralClick_partnerId_fkey', 'ALTER TABLE "ReferralClick" ADD CONSTRAINT "ReferralClick_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralAttribution_organizationId_fkey', 'ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralAttribution_propertyId_fkey', 'ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralAttribution_programId_fkey', 'ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralAttribution_partnerId_fkey', 'ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralAttribution_campaignId_fkey', 'ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralAttribution_clickId_fkey', 'ALTER TABLE "ReferralAttribution" ADD CONSTRAINT "ReferralAttribution_clickId_fkey" FOREIGN KEY ("clickId") REFERENCES "ReferralClick"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralBooking_organizationId_fkey', 'ALTER TABLE "ReferralBooking" ADD CONSTRAINT "ReferralBooking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralBooking_propertyId_fkey', 'ALTER TABLE "ReferralBooking" ADD CONSTRAINT "ReferralBooking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralBooking_programId_fkey', 'ALTER TABLE "ReferralBooking" ADD CONSTRAINT "ReferralBooking_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralBooking_partnerId_fkey', 'ALTER TABLE "ReferralBooking" ADD CONSTRAINT "ReferralBooking_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralBooking_campaignId_fkey', 'ALTER TABLE "ReferralBooking" ADD CONSTRAINT "ReferralBooking_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ReferralCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralBooking_attributionId_fkey', 'ALTER TABLE "ReferralBooking" ADD CONSTRAINT "ReferralBooking_attributionId_fkey" FOREIGN KEY ("attributionId") REFERENCES "ReferralAttribution"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralBooking_reservationId_fkey', 'ALTER TABLE "ReferralBooking" ADD CONSTRAINT "ReferralBooking_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralBooking_eventId_fkey', 'ALTER TABLE "ReferralBooking" ADD CONSTRAINT "ReferralBooking_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralCommission_organizationId_fkey', 'ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralCommission_propertyId_fkey', 'ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralCommission_programId_fkey', 'ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralCommission_partnerId_fkey', 'ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralCommission_referralBookingId_fkey', 'ALTER TABLE "ReferralCommission" ADD CONSTRAINT "ReferralCommission_referralBookingId_fkey" FOREIGN KEY ("referralBookingId") REFERENCES "ReferralBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralPayout_organizationId_fkey', 'ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralPayout_propertyId_fkey', 'ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralPayout_partnerId_fkey', 'ALTER TABLE "ReferralPayout" ADD CONSTRAINT "ReferralPayout_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralLedgerEntry_organizationId_fkey', 'ALTER TABLE "ReferralLedgerEntry" ADD CONSTRAINT "ReferralLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralLedgerEntry_partnerId_fkey', 'ALTER TABLE "ReferralLedgerEntry" ADD CONSTRAINT "ReferralLedgerEntry_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralLedgerEntry_commissionId_fkey', 'ALTER TABLE "ReferralLedgerEntry" ADD CONSTRAINT "ReferralLedgerEntry_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "ReferralCommission"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralLedgerEntry_payoutId_fkey', 'ALTER TABLE "ReferralLedgerEntry" ADD CONSTRAINT "ReferralLedgerEntry_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "ReferralPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralPayoutItem_payoutId_fkey', 'ALTER TABLE "ReferralPayoutItem" ADD CONSTRAINT "ReferralPayoutItem_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "ReferralPayout"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralPayoutItem_commissionId_fkey', 'ALTER TABLE "ReferralPayoutItem" ADD CONSTRAINT "ReferralPayoutItem_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "ReferralCommission"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralPlatformFee_organizationId_fkey', 'ALTER TABLE "ReferralPlatformFee" ADD CONSTRAINT "ReferralPlatformFee_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralPlatformFee_propertyId_fkey', 'ALTER TABLE "ReferralPlatformFee" ADD CONSTRAINT "ReferralPlatformFee_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralPlatformFee_programId_fkey', 'ALTER TABLE "ReferralPlatformFee" ADD CONSTRAINT "ReferralPlatformFee_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralPlatformFee_referralBookingId_fkey', 'ALTER TABLE "ReferralPlatformFee" ADD CONSTRAINT "ReferralPlatformFee_referralBookingId_fkey" FOREIGN KEY ("referralBookingId") REFERENCES "ReferralBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralActivationPayment_organizationId_fkey', 'ALTER TABLE "ReferralActivationPayment" ADD CONSTRAINT "ReferralActivationPayment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralActivationPayment_propertyId_fkey', 'ALTER TABLE "ReferralActivationPayment" ADD CONSTRAINT "ReferralActivationPayment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReferralActivationPayment_programId_fkey', 'ALTER TABLE "ReferralActivationPayment" ADD CONSTRAINT "ReferralActivationPayment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "ReferralProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE');

INSERT INTO "ChartOfAccount" ("id", "propertyId", "code", "name", "type", "category", "normalBalance", "description", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", '2205', 'Reach Partner Commissions Payable', 'LIABILITY'::"AccountType", 'Current Liabilities', 'CREDIT'::"BalanceSide", 'Outstanding commissions owed to Reach partners.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Property" p
WHERE NOT EXISTS (SELECT 1 FROM "ChartOfAccount" a WHERE a."propertyId" = p."id" AND a."code" = '2205');

INSERT INTO "ChartOfAccount" ("id", "propertyId", "code", "name", "type", "category", "normalBalance", "description", "isActive", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", '5200', 'Reach Commission Expense', 'EXPENSE'::"AccountType", 'Selling and Marketing', 'DEBIT'::"BalanceSide", 'Commission expense for LodgeCore Reach referrals.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Property" p
WHERE NOT EXISTS (SELECT 1 FROM "ChartOfAccount" a WHERE a."propertyId" = p."id" AND a."code" = '5200');

-- HQ-only Reach platform-fee profile. These accounts intentionally have no
-- organizationId or propertyId and are never inserted into hotel charts.
CREATE TABLE IF NOT EXISTS "HqChartOfAccount" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "normalBalance" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HqChartOfAccount_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HqChartOfAccount_code_key" ON "HqChartOfAccount"("code");

CREATE TABLE IF NOT EXISTS "HqJournalEntry" (
    "id" UUID NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "source" TEXT NOT NULL DEFAULT 'REACH',
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "totalDebit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalCredit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HqJournalEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "HqJournalEntry_entryNumber_key" ON "HqJournalEntry"("entryNumber");

CREATE TABLE IF NOT EXISTS "HqJournalEntryLine" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "debit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "description" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    CONSTRAINT "HqJournalEntryLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "HqJournalEntryLine_entryId_idx" ON "HqJournalEntryLine"("entryId");
CREATE INDEX IF NOT EXISTS "HqJournalEntryLine_accountId_idx" ON "HqJournalEntryLine"("accountId");
CREATE UNIQUE INDEX IF NOT EXISTS "HqJournalEntryLine_sourceType_sourceId_accountId_key" ON "HqJournalEntryLine"("sourceType", "sourceId", "accountId");
SELECT pg_temp.add_reach_fk('HqJournalEntryLine_entryId_fkey', 'ALTER TABLE "HqJournalEntryLine" ADD CONSTRAINT "HqJournalEntryLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "HqJournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('HqJournalEntryLine_accountId_fkey', 'ALTER TABLE "HqJournalEntryLine" ADD CONSTRAINT "HqJournalEntryLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "HqChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE');

-- Organization wallet and property-level Reach debt. Wallet funds are a
-- customer liability held by HQ; they are never posted to a hotel chart.
CREATE TABLE IF NOT EXISTS "ReachWallet" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReachWallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReachWallet_organizationId_key" ON "ReachWallet"("organizationId");
CREATE INDEX IF NOT EXISTS "ReachWallet_organizationId_status_idx" ON "ReachWallet"("organizationId", "status");

CREATE TABLE IF NOT EXISTS "ReachWalletTransaction" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID,
    "referralPlatformFeeId" UUID,
    "hqJournalEntryId" UUID,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4),
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "provider" TEXT,
    "providerReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,
    CONSTRAINT "ReachWalletTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReachWalletTransaction_idempotencyKey_key" ON "ReachWalletTransaction"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ReachWalletTransaction_organizationId_createdAt_idx" ON "ReachWalletTransaction"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReachWalletTransaction_propertyId_createdAt_idx" ON "ReachWalletTransaction"("propertyId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReachWalletTransaction_providerReference_idx" ON "ReachWalletTransaction"("providerReference");
CREATE INDEX IF NOT EXISTS "ReachWalletTransaction_referralPlatformFeeId_idx" ON "ReachWalletTransaction"("referralPlatformFeeId");

CREATE TABLE IF NOT EXISTS "ReachPropertyDebt" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "outstandingAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "suspensionThreshold" DECIMAL(18,4) NOT NULL DEFAULT 50000,
    "status" TEXT NOT NULL DEFAULT 'CURRENT',
    "suspendedAt" TIMESTAMPTZ,
    "clearedAt" TIMESTAMPTZ,
    "lastEvaluatedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReachPropertyDebt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReachPropertyDebt_propertyId_key" ON "ReachPropertyDebt"("propertyId");
CREATE UNIQUE INDEX IF NOT EXISTS "ReachPropertyDebt_organizationId_propertyId_key" ON "ReachPropertyDebt"("organizationId", "propertyId");
CREATE INDEX IF NOT EXISTS "ReachPropertyDebt_organizationId_status_idx" ON "ReachPropertyDebt"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "ReachPropertyDebt_status_outstandingAmount_idx" ON "ReachPropertyDebt"("status", "outstandingAmount");

SELECT pg_temp.add_reach_fk('ReachWallet_organizationId_fkey', 'ALTER TABLE "ReachWallet" ADD CONSTRAINT "ReachWallet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReachWalletTransaction_walletId_fkey', 'ALTER TABLE "ReachWalletTransaction" ADD CONSTRAINT "ReachWalletTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "ReachWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReachPropertyDebt_organizationId_fkey', 'ALTER TABLE "ReachPropertyDebt" ADD CONSTRAINT "ReachPropertyDebt_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE');
SELECT pg_temp.add_reach_fk('ReachPropertyDebt_propertyId_fkey', 'ALTER TABLE "ReachPropertyDebt" ADD CONSTRAINT "ReachPropertyDebt_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE');

-- HQ-only accounts: Flutterwave clearing, customer wallet liability,
-- platform-fee receivable and Reach platform-fee revenue.
INSERT INTO "HqChartOfAccount" ("id", "code", "name", "type", "normalBalance") VALUES
  (gen_random_uuid(), '1015', 'Flutterwave Reach Wallet Clearing', 'ASSET', 'DEBIT'),
  (gen_random_uuid(), '2305', 'Customer Reach Wallet Liability', 'LIABILITY', 'CREDIT'),
  (gen_random_uuid(), '4460', 'Reach Activation Revenue', 'REVENUE', 'CREDIT')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "HqChartOfAccount" ("id", "code", "name", "type", "normalBalance")
VALUES
  (gen_random_uuid(), '1205', 'Reach Platform Fee Receivable', 'ASSET', 'DEBIT'),
  (gen_random_uuid(), '4450', 'Reach Platform Fee Revenue', 'REVENUE', 'CREDIT')
ON CONFLICT ("code") DO NOTHING;

-- Publish Reach as a normal HQ-managed add-on. The price is inserted only if
-- absent, so later edits made in /hq/products are preserved on reruns.
INSERT INTO "BillingProduct" ("id", "code", "name", "type", "active", "catalogVersion", "metadata", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'ADDON_REACH', 'LodgeCore Reach Referral Network', 'ADDON', true, 1, '{"family":"REVENUE","unit":"PROPERTY","sellable":true,"oneTime":true,"activation":true}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "BillingPrice" ("id", "productId", "amount", "currency", "interval", "catalogVersion", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", 5000000, 'ngn', 'one_time', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "BillingProduct" p
WHERE p."code" = 'ADDON_REACH'
  AND NOT EXISTS (SELECT 1 FROM "BillingPrice" b WHERE b."productId" = p."id" AND b."interval" = 'one_time' AND b."catalogVersion" = 1);
