-- Employee reimbursement payment preference and HR-controlled auto-bank switch.
BEGIN;
ALTER TABLE "Property"
  ADD COLUMN IF NOT EXISTS "autoBankReimbursementEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ExpenseClaim"
  ADD COLUMN IF NOT EXISTS "requestedPaymentMethod" TEXT NOT NULL DEFAULT 'CASH',
  ADD COLUMN IF NOT EXISTS "autoPaymentStatus" TEXT;
COMMIT;
