ALTER TABLE "ReferralPartner" ADD COLUMN IF NOT EXISTS "businessName" TEXT;
ALTER TABLE "ReferralPartner" ADD COLUMN IF NOT EXISTS "directorName" TEXT;

UPDATE "ReferralPartner"
SET "businessName" = COALESCE(NULLIF("businessName", ''), "displayName")
WHERE "businessName" IS NULL OR "businessName" = '';

ALTER TABLE "ReferralPartner" ALTER COLUMN "businessName" SET DEFAULT '';
ALTER TABLE "ReferralPartner" ALTER COLUMN "businessName" SET NOT NULL;
