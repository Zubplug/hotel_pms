-- Enterprise Night Audit close evidence and canonical transaction dates.
-- This migration is additive. Existing dates are derived from the recorded
-- original business date where available, otherwise the property's local date
-- at transaction creation time.

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "businessDate" DATE;
ALTER TABLE "Refund" ADD COLUMN IF NOT EXISTS "businessDate" DATE;

UPDATE "Payment" AS payment
SET "businessDate" = COALESCE(
  payment."originalBusinessDate",
  (payment."createdAt" AT TIME ZONE property."timezone")::date
)
FROM "Property" AS property
WHERE property."id" = payment."propertyId"
  AND payment."businessDate" IS NULL;

UPDATE "Refund" AS refund
SET "businessDate" = (refund."createdAt" AT TIME ZONE property."timezone")::date
FROM "Property" AS property
WHERE property."id" = refund."propertyId"
  AND refund."businessDate" IS NULL;

CREATE INDEX IF NOT EXISTS "Payment_propertyId_businessDate_idx"
  ON "Payment"("propertyId", "businessDate");
CREATE INDEX IF NOT EXISTS "Refund_propertyId_businessDate_idx"
  ON "Refund"("propertyId", "businessDate");

ALTER TABLE "JournalEntry" ADD COLUMN IF NOT EXISTS "nightAuditId" UUID;
CREATE INDEX IF NOT EXISTS "JournalEntry_propertyId_nightAuditId_idx"
  ON "JournalEntry"("propertyId", "nightAuditId");
CREATE UNIQUE INDEX IF NOT EXISTS "JournalEntry_propertyId_nightAuditId_key"
  ON "JournalEntry"("propertyId", "nightAuditId")
  WHERE "nightAuditId" IS NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'JournalEntry_nightAuditId_fkey'
  ) THEN
    ALTER TABLE "JournalEntry"
      ADD CONSTRAINT "JournalEntry_nightAuditId_fkey"
      FOREIGN KEY ("nightAuditId") REFERENCES "NightAudit"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "NightAuditClosePackage" (
  "id" UUID NOT NULL,
  "nightAuditId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "businessDate" DATE NOT NULL,
  "status" TEXT NOT NULL,
  "sourceTotals" JSONB NOT NULL,
  "balanceProof" JSONB NOT NULL,
  "controlSummary" JSONB NOT NULL,
  "reportManifest" JSONB NOT NULL,
  "journalEntryIds" JSONB NOT NULL,
  "packageHash" TEXT,
  "createdBy" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizedAt" TIMESTAMPTZ,
  CONSTRAINT "NightAuditClosePackage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NightAuditClosePackage_nightAuditId_key" UNIQUE ("nightAuditId"),
  CONSTRAINT "NightAuditClosePackage_packageHash_key" UNIQUE ("packageHash"),
  CONSTRAINT "NightAuditClosePackage_nightAuditId_fkey"
    FOREIGN KEY ("nightAuditId") REFERENCES "NightAudit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NightAuditClosePackage_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "NightAuditClosePackage_propertyId_businessDate_idx"
  ON "NightAuditClosePackage"("propertyId", "businessDate");
CREATE INDEX IF NOT EXISTS "NightAuditClosePackage_propertyId_status_idx"
  ON "NightAuditClosePackage"("propertyId", "status");

CREATE TABLE IF NOT EXISTS "NightAuditBalanceSnapshot" (
  "id" UUID NOT NULL,
  "closePackageId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "businessDate" DATE NOT NULL,
  "ledgerType" TEXT NOT NULL,
  "accountKey" TEXT NOT NULL,
  "openingBalance" DECIMAL(18,4) NOT NULL,
  "activityDebit" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "activityCredit" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "expectedClosing" DECIMAL(18,4) NOT NULL,
  "actualClosing" DECIMAL(18,4),
  "variance" DECIMAL(18,4),
  "status" TEXT NOT NULL,
  "resolution" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NightAuditBalanceSnapshot_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "NightAuditBalanceSnapshot_closePackageId_fkey"
    FOREIGN KEY ("closePackageId") REFERENCES "NightAuditClosePackage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "NightAuditBalanceSnapshot_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "NightAuditBalanceSnapshot_closePackageId_ledgerType_accountKey_key"
    UNIQUE ("closePackageId", "ledgerType", "accountKey")
);
CREATE INDEX IF NOT EXISTS "NightAuditBalanceSnapshot_propertyId_businessDate_ledgerType_idx"
  ON "NightAuditBalanceSnapshot"("propertyId", "businessDate", "ledgerType");

ALTER TABLE "NightAuditFinancialSnapshot"
  ADD COLUMN IF NOT EXISTS "paymentTotals" JSONB,
  ADD COLUMN IF NOT EXISTS "cashExpected" DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "cashDeclared" DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "cashVariance" DECIMAL(18,4),
  ADD COLUMN IF NOT EXISTS "unresolvedExceptionCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "latePostingCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "voidCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "adjustmentCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "journalEntryIds" JSONB,
  ADD COLUMN IF NOT EXISTS "reconciliationStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "snapshotHash" TEXT,
  ADD COLUMN IF NOT EXISTS "finalizedAt" TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS "NightAuditFinancialSnapshot_snapshotHash_key"
  ON "NightAuditFinancialSnapshot"("snapshotHash") WHERE "snapshotHash" IS NOT NULL;
      
