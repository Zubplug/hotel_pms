CREATE TABLE IF NOT EXISTS "ReferralPartnerPropertyWallet" (
    "id" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "availableBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "ReferralPartnerPropertyWallet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPartnerPropertyWallet_partnerId_propertyId_key"
  ON "ReferralPartnerPropertyWallet"("partnerId", "propertyId");
CREATE INDEX IF NOT EXISTS "ReferralPartnerPropertyWallet_partnerId_status_updatedAt_idx"
  ON "ReferralPartnerPropertyWallet"("partnerId", "status", "updatedAt");
CREATE INDEX IF NOT EXISTS "ReferralPartnerPropertyWallet_propertyId_status_idx"
  ON "ReferralPartnerPropertyWallet"("propertyId", "status");
ALTER TABLE "ReferralPartnerPropertyWallet" ADD CONSTRAINT "ReferralPartnerPropertyWallet_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralPartnerPropertyWallet" ADD CONSTRAINT "ReferralPartnerPropertyWallet_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ReferralPartnerPropertyWalletTransaction" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "partnerId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "commissionId" UUID,
    "payoutId" UUID,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "amount" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "idempotencyKey" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMPTZ,
    CONSTRAINT "ReferralPartnerPropertyWalletTransaction_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "ReferralPartnerPropertyWalletTransaction_idempotencyKey_key"
  ON "ReferralPartnerPropertyWalletTransaction"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "ReferralPartnerPropertyWalletTransaction_partnerId_createdAt_idx"
  ON "ReferralPartnerPropertyWalletTransaction"("partnerId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralPartnerPropertyWalletTransaction_walletId_createdAt_idx"
  ON "ReferralPartnerPropertyWalletTransaction"("walletId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralPartnerPropertyWalletTransaction_propertyId_createdAt_idx"
  ON "ReferralPartnerPropertyWalletTransaction"("propertyId", "createdAt");
CREATE INDEX IF NOT EXISTS "ReferralPartnerPropertyWalletTransaction_commissionId_idx"
  ON "ReferralPartnerPropertyWalletTransaction"("commissionId");
CREATE INDEX IF NOT EXISTS "ReferralPartnerPropertyWalletTransaction_payoutId_idx"
  ON "ReferralPartnerPropertyWalletTransaction"("payoutId");
ALTER TABLE "ReferralPartnerPropertyWalletTransaction" ADD CONSTRAINT "ReferralPartnerPropertyWalletTransaction_walletId_fkey"
  FOREIGN KEY ("walletId") REFERENCES "ReferralPartnerPropertyWallet"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralPartnerPropertyWalletTransaction" ADD CONSTRAINT "ReferralPartnerPropertyWalletTransaction_partnerId_fkey"
  FOREIGN KEY ("partnerId") REFERENCES "ReferralPartner"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralPartnerPropertyWalletTransaction" ADD CONSTRAINT "ReferralPartnerPropertyWalletTransaction_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferralPartnerPropertyWalletTransaction" ADD CONSTRAINT "ReferralPartnerPropertyWalletTransaction_commissionId_fkey"
  FOREIGN KEY ("commissionId") REFERENCES "ReferralCommission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferralPartnerPropertyWalletTransaction" ADD CONSTRAINT "ReferralPartnerPropertyWalletTransaction_payoutId_fkey"
  FOREIGN KEY ("payoutId") REFERENCES "ReferralPayout"("id") ON DELETE SET NULL ON UPDATE CASCADE;
