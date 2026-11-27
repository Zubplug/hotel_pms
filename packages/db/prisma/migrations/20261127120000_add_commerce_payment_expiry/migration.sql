-- Adds the payment deadline used to expire abandoned public Commerce checkouts.
-- Existing orders remain valid: NULL means no deadline (legacy/pay-later order).
ALTER TABLE "CommerceOrder"
  ADD COLUMN IF NOT EXISTS "paymentExpiresAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "CommerceOrder_status_paymentStatus_paymentExpiresAt_idx"
  ON "CommerceOrder"("status", "paymentStatus", "paymentExpiresAt");
