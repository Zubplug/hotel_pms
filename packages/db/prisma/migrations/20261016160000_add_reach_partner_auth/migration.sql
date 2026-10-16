-- Dedicated LodgeCore Reach partner authentication.
-- Partner credentials and sessions are separate from customer/HQ users.

ALTER TABLE "ReferralPartner" ADD COLUMN IF NOT EXISTS "passwordHash" TEXT;
ALTER TABLE "ReferralPartner" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS "ReferralPartnerSession" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "lastSeenAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReferralPartnerSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPartnerSession_tokenHash_key" ON "ReferralPartnerSession"("tokenHash");
CREATE INDEX IF NOT EXISTS "ReferralPartnerSession_partnerId_expiresAt_idx" ON "ReferralPartnerSession"("partnerId", "expiresAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReferralPartnerSession_partnerId_fkey') THEN
    ALTER TABLE "ReferralPartnerSession"
      ADD CONSTRAINT "ReferralPartnerSession_partnerId_fkey"
      FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
