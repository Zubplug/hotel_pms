-- Adds the checkout-level idempotency boundary after Commerce foundation.
-- Safe to run manually against production; existing orders remain valid.
ALTER TABLE "CommerceOrder"
  ADD COLUMN IF NOT EXISTS "clientIdempotencyKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "CommerceOrder_storeId_clientIdempotencyKey_key"
  ON "CommerceOrder"("storeId", "clientIdempotencyKey")
  WHERE "clientIdempotencyKey" IS NOT NULL;
