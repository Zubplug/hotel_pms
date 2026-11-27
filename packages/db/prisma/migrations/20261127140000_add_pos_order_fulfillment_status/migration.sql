-- Separates customer handover state from the core POS order lifecycle.
-- Existing POS orders remain operationally unchanged.
ALTER TABLE "PosOrder"
  ADD COLUMN IF NOT EXISTS "fulfillmentStatus" TEXT NOT NULL DEFAULT 'NONE';

CREATE INDEX IF NOT EXISTS "PosOrder_fulfillmentStatus_idx"
  ON "PosOrder"("fulfillmentStatus");
