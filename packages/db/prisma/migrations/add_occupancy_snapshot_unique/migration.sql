-- Migration: add_occupancy_snapshot_unique
--
-- OPTION A — Supabase Dashboard / any SQL client that wraps in a transaction
-- Use this if the OccupancySnapshot table is small (it is populated only by
-- Night Audit completions, so it will have at most one row per business date).
-- A plain CREATE UNIQUE INDEX briefly locks the table for writes; on a sparse
-- table this is instantaneous.
--
CREATE UNIQUE INDEX IF NOT EXISTS
  "OccupancySnapshot_propertyId_businessDate_key"
  ON "OccupancySnapshot" ("propertyId", "businessDate");

ALTER TABLE "OccupancySnapshot"
  ADD CONSTRAINT "OccupancySnapshot_propertyId_businessDate_key"
  UNIQUE USING INDEX "OccupancySnapshot_propertyId_businessDate_key";


-- ─────────────────────────────────────────────────────────────────────────────
-- OPTION B — psql / direct connection only (NOT inside Supabase dashboard)
-- Use this if the table is large and you cannot afford any write-lock at all.
-- Run these two statements as separate commands outside any transaction block.
-- DO NOT wrap in BEGIN / COMMIT.
--
-- CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS
--   "OccupancySnapshot_propertyId_businessDate_key"
--   ON "OccupancySnapshot" ("propertyId", "businessDate");
--
-- ALTER TABLE "OccupancySnapshot"
--   ADD CONSTRAINT "OccupancySnapshot_propertyId_businessDate_key"
--   UNIQUE USING INDEX "OccupancySnapshot_propertyId_businessDate_key";
