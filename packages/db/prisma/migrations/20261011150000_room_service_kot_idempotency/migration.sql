-- Room-service-only KOT idempotency.
-- Normal TABLE orders may legitimately have multiple batches for the same
-- station, so uniqueness must not be enforced on (orderId, station).

ALTER TABLE "PosProductionBatch"
  DROP CONSTRAINT IF EXISTS "PosProductionBatch_orderId_station_key";

ALTER TABLE "PosProductionBatch"
  ADD COLUMN IF NOT EXISTS "roomServiceOperationId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "PosProductionBatch_roomServiceOperationId_key"
  ON "PosProductionBatch" ("roomServiceOperationId");
