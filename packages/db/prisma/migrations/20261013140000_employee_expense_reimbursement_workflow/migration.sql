-- Employee expense reimbursement maker-checker workflow.
-- Additive only: existing claims and their history are preserved.
BEGIN;

ALTER TABLE "ExpenseClaim"
  ADD COLUMN IF NOT EXISTS "hrReviewedBy" UUID,
  ADD COLUMN IF NOT EXISTS "hrReviewedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "accountantReviewedBy" UUID,
  ADD COLUMN IF NOT EXISTS "accountantReviewedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "managerApprovedBy" UUID,
  ADD COLUMN IF NOT EXISTS "managerApprovedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentReference" TEXT,
  ADD COLUMN IF NOT EXISTS "paidBy" UUID,
  ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "paymentAccountId" UUID,
  ADD COLUMN IF NOT EXISTS "accountingJournalEntryId" UUID;

CREATE INDEX IF NOT EXISTS "ExpenseClaim_propertyId_status_createdAt_idx"
  ON "ExpenseClaim"("propertyId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "ExpenseClaim_staffId_createdAt_idx"
  ON "ExpenseClaim"("staffId", "createdAt");

-- Legacy submitted claims enter the first review queue without changing their
-- amount, owner, receipt, or historical timestamps.
UPDATE "ExpenseClaim"
SET "status" = 'HR_REVIEW'
WHERE "status" = 'SUBMITTED';

COMMIT;
