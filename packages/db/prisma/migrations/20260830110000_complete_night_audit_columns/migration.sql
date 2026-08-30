-- Complete NightAudit columns for databases created from the early audit table.
-- All additions are idempotent to support partially repaired environments.

ALTER TABLE "NightAudit"
  ADD COLUMN IF NOT EXISTS "roomChargesPosted" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalRoomRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "occupancy" DECIMAL(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "adr" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "revpar" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "exceptions" JSONB,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;
