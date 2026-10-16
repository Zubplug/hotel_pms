ALTER TABLE "ReferralPartner" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "ReferralPartner" ADD COLUMN IF NOT EXISTS "middleName" TEXT;
ALTER TABLE "ReferralPartner" ADD COLUMN IF NOT EXISTS "lastName" TEXT;

-- Business/company name is optional for individual partners.
ALTER TABLE "ReferralPartner" ALTER COLUMN "businessName" DROP NOT NULL;
ALTER TABLE "ReferralPartner" ALTER COLUMN "businessName" DROP DEFAULT;
