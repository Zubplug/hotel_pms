-- Adds deterministic, property-managed delivery-area matching metadata.
-- Existing zones remain valid and continue to require manual selection until
-- their keywords or postal codes are configured.
ALTER TABLE "CommerceDeliveryZone"
  ADD COLUMN IF NOT EXISTS "matchKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "postalCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
