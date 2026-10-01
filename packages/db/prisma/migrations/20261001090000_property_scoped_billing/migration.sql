-- Production billing scope and property-aware entitlements.
-- Existing organisation-level entitlements are preserved with propertyId = NULL.

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "scopePropertyIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];

ALTER TABLE "SubscriptionItem"
  ADD COLUMN IF NOT EXISTS "quantity" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "Entitlement"
  ADD COLUMN IF NOT EXISTS "propertyId" UUID;

ALTER TABLE "Entitlement"
  ADD COLUMN IF NOT EXISTS "scopeKey" TEXT;

UPDATE "Entitlement"
SET "scopeKey" = "organizationId"::text || ':' || COALESCE("propertyId"::text, '*') || ':' || "productCode"
WHERE "scopeKey" IS NULL;

ALTER TABLE "Entitlement"
  ALTER COLUMN "scopeKey" SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Entitlement_propertyId_fkey') THEN
    ALTER TABLE "Entitlement"
      ADD CONSTRAINT "Entitlement_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DROP INDEX IF EXISTS "Entitlement_organizationId_productCode_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Entitlement_scopeKey_key"
  ON "Entitlement"("scopeKey");
DROP INDEX IF EXISTS "Entitlement_organizationId_status_idx";
CREATE INDEX IF NOT EXISTS "Entitlement_organizationId_propertyId_status_idx"
  ON "Entitlement"("organizationId", "propertyId", "status");

ALTER TABLE "Entitlement"
  ADD CONSTRAINT "Entitlement_property_belongs_to_organization"
  CHECK ("propertyId" IS NULL OR "organizationId" IS NOT NULL);
