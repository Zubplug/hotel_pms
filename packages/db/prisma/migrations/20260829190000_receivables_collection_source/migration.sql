ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "collectionSource" TEXT NOT NULL DEFAULT 'FRONT_DESK';

CREATE INDEX IF NOT EXISTS "Payment_propertyId_collectionSource_createdAt_idx"
  ON "Payment"("propertyId", "collectionSource", "createdAt");
