-- Preserve complimentary guest amenity COGS and room contribution in each
-- immutable night-audit financial snapshot.
ALTER TABLE "NightAuditFinancialSnapshot"
  ADD COLUMN IF NOT EXISTS "guestAmenityCost" NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "netRoomContribution" NUMERIC(18, 4) NOT NULL DEFAULT 0;
