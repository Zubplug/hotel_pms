CREATE TABLE IF NOT EXISTS "PaymentCorrection" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "originalPaymentId" UUID NOT NULL,
    "replacementPaymentId" UUID,
    "originalMethod" TEXT NOT NULL,
    "correctedMethod" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "correctedAmount" DECIMAL(18,4),
    "currency" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "supportingReference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "requestedById" UUID NOT NULL,
    "approvedById" UUID,
    "rejectedById" UUID,
    "rejectionReason" TEXT,
    "originalJournalId" UUID,
    "reversalJournalId" UUID,
    "replacementJournalId" UUID,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMPTZ,
    "postedAt" TIMESTAMPTZ,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "PaymentCorrection_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "PaymentCorrection" ADD COLUMN IF NOT EXISTS "correctedAmount" DECIMAL(18,4);
UPDATE "PaymentCorrection" SET "correctedAmount" = "amount" WHERE "correctedAmount" IS NULL;
ALTER TABLE "PaymentCorrection" ALTER COLUMN "correctedAmount" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentCorrection_originalPaymentId_key" ON "PaymentCorrection"("originalPaymentId");
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentCorrection_idempotencyKey_key" ON "PaymentCorrection"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "PaymentCorrection_propertyId_status_createdAt_idx" ON "PaymentCorrection"("propertyId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "PaymentCorrection_replacementPaymentId_idx" ON "PaymentCorrection"("replacementPaymentId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentCorrection_propertyId_fkey') THEN
    ALTER TABLE "PaymentCorrection" ADD CONSTRAINT "PaymentCorrection_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentCorrection_originalPaymentId_fkey') THEN
    ALTER TABLE "PaymentCorrection" ADD CONSTRAINT "PaymentCorrection_originalPaymentId_fkey" FOREIGN KEY ("originalPaymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PaymentCorrection_replacementPaymentId_fkey') THEN
    ALTER TABLE "PaymentCorrection" ADD CONSTRAINT "PaymentCorrection_replacementPaymentId_fkey" FOREIGN KEY ("replacementPaymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
