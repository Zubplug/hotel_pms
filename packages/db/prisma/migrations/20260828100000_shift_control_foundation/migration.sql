-- Additive shift-control foundation. Legacy statuses and fields are retained.

ALTER TYPE "PosSessionStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "PosSessionStatus" ADD VALUE IF NOT EXISTS 'UNDER_REVIEW';
ALTER TYPE "PosSessionStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "PosSessionStatus" ADD VALUE IF NOT EXISTS 'APPROVED_WITH_VARIANCE';
ALTER TYPE "PosSessionStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "PosSessionStatus" ADD VALUE IF NOT EXISTS 'HANDOVER_PENDING';
ALTER TYPE "PosSessionStatus" ADD VALUE IF NOT EXISTS 'HANDED_OVER';
ALTER TYPE "PosSessionStatus" ADD VALUE IF NOT EXISTS 'DEPOSIT_PENDING';
ALTER TYPE "PosSessionStatus" ADD VALUE IF NOT EXISTS 'DEPOSITED';
ALTER TYPE "PosSessionStatus" ADD VALUE IF NOT EXISTS 'UNDER_RECONCILIATION';

ALTER TYPE "FrontdeskSessionStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED';
ALTER TYPE "FrontdeskSessionStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "FrontdeskSessionStatus" ADD VALUE IF NOT EXISTS 'APPROVED_WITH_VARIANCE';
ALTER TYPE "FrontdeskSessionStatus" ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE "FrontdeskSessionStatus" ADD VALUE IF NOT EXISTS 'HANDOVER_PENDING';
ALTER TYPE "FrontdeskSessionStatus" ADD VALUE IF NOT EXISTS 'HANDED_OVER';
ALTER TYPE "FrontdeskSessionStatus" ADD VALUE IF NOT EXISTS 'DEPOSIT_PENDING';
ALTER TYPE "FrontdeskSessionStatus" ADD VALUE IF NOT EXISTS 'DEPOSITED';
ALTER TYPE "FrontdeskSessionStatus" ADD VALUE IF NOT EXISTS 'UNDER_RECONCILIATION';

ALTER TABLE "PosSession"
  ADD COLUMN IF NOT EXISTS "controlStatus" TEXT NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS "varianceStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "submittedBy" UUID,
  ADD COLUMN IF NOT EXISTS "reviewStartedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "reviewStartedBy" UUID,
  ADD COLUMN IF NOT EXISTS "approvalDecision" TEXT,
  ADD COLUMN IF NOT EXISTS "approvalNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "handoverAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "depositedAt" TIMESTAMPTZ;

ALTER TABLE "FrontdeskSession"
  ADD COLUMN IF NOT EXISTS "controlStatus" TEXT NOT NULL DEFAULT 'OPEN',
  ADD COLUMN IF NOT EXISTS "varianceStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "submittedBy" UUID,
  ADD COLUMN IF NOT EXISTS "reviewStartedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "reviewStartedBy" UUID,
  ADD COLUMN IF NOT EXISTS "approvalDecision" TEXT,
  ADD COLUMN IF NOT EXISTS "approvalNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "handoverAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "depositedAt" TIMESTAMPTZ;

ALTER TABLE "ReconciliationException"
  ADD COLUMN IF NOT EXISTS "acceptedBy" UUID,
  ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "resolutionNotes" TEXT;

ALTER TABLE "CashHandover"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CashHandover_idempotencyKey_key"
  ON "CashHandover"("idempotencyKey")
  WHERE "idempotencyKey" IS NOT NULL;

-- Compatibility map for the new control reader; legacy status is retained.
UPDATE "PosSession"
SET "controlStatus" = CASE
  WHEN "status" = 'RECONCILED' THEN 'RECONCILED'
  WHEN "status" IN ('RECONCILIATION_REQUIRED', 'CLOSED') THEN 'SUBMITTED'
  ELSE 'OPEN'
END
WHERE "controlStatus" = 'OPEN';

UPDATE "FrontdeskSession"
SET "controlStatus" = CASE
  WHEN "status" = 'RECONCILED' THEN 'RECONCILED'
  WHEN "status" = 'UNDER_REVIEW' THEN 'UNDER_REVIEW'
  WHEN "status" IN ('CLOSED', 'CLOSING') THEN 'SUBMITTED'
  ELSE 'OPEN'
END
WHERE "controlStatus" = 'OPEN';

CREATE TABLE "ShiftControlAudit" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "posSessionId" UUID,
  "frontdeskSessionId" UUID,
  "action" TEXT NOT NULL,
  "fromStatus" TEXT,
  "toStatus" TEXT,
  "performedBy" UUID NOT NULL,
  "reason" TEXT,
  "metadata" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShiftControlAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShiftControlAudit_idempotencyKey_key" ON "ShiftControlAudit"("idempotencyKey");
CREATE INDEX "ShiftControlAudit_propertyId_createdAt_idx" ON "ShiftControlAudit"("propertyId", "createdAt");
CREATE INDEX "ShiftControlAudit_posSessionId_createdAt_idx" ON "ShiftControlAudit"("posSessionId", "createdAt");
CREATE INDEX "ShiftControlAudit_frontdeskSessionId_createdAt_idx" ON "ShiftControlAudit"("frontdeskSessionId", "createdAt");

-- CENTRAL_CASHIER has exactly one open bank per property/outlet. This also
-- prevents two terminals from opening competing central banks concurrently.
CREATE UNIQUE INDEX IF NOT EXISTS "PosSession_one_open_central_bank_per_outlet_key"
  ON "PosSession"("propertyId", "outletId", "bankType", "bankingModel")
  WHERE "status" = 'OPEN'
    AND "bankType" = 'CENTRAL'
    AND "bankingModel" = 'CENTRAL_CASHIER';

ALTER TABLE "ShiftControlAudit"
  ADD CONSTRAINT "ShiftControlAudit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ShiftControlAudit_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES "PosSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ShiftControlAudit_frontdeskSessionId_fkey" FOREIGN KEY ("frontdeskSessionId") REFERENCES "FrontdeskSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "ShiftControlAudit_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Existing legacy status fields remain unchanged. The control-status columns
-- are backfilled above so deployed readers can interpret existing records.
