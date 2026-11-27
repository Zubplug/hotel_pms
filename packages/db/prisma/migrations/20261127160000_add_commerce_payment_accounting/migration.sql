-- Durable accounting state for verified Food Commerce payments.
-- Existing payments remain valid and will be reconciled as PENDING.
ALTER TABLE "CommercePayment"
  ADD COLUMN IF NOT EXISTS "accountingStatus" TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "accountingJournalId" UUID,
  ADD COLUMN IF NOT EXISTS "accountingPostedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "accountingFailureReason" TEXT,
  ADD COLUMN IF NOT EXISTS "refundAccountingStatus" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "refundAccountingJournalId" UUID,
  ADD COLUMN IF NOT EXISTS "refundAccountingPostedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "refundAccountingFailureReason" TEXT;

CREATE INDEX IF NOT EXISTS "CommercePayment_accountingStatus_idx"
  ON "CommercePayment"("accountingStatus");

CREATE INDEX IF NOT EXISTS "CommercePayment_refundAccountingStatus_idx"
  ON "CommercePayment"("refundAccountingStatus");
