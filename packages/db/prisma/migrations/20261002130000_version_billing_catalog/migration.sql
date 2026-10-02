-- Versioned product metadata for the entitlement-driven catalogue.
-- Existing products, prices, subscriptions and invoices are preserved.
ALTER TABLE "BillingProduct"
  ADD COLUMN IF NOT EXISTS "catalogVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TABLE "BillingPrice"
  ADD COLUMN IF NOT EXISTS "catalogVersion" INTEGER NOT NULL DEFAULT 1;

-- Older HQ flows could create duplicate prices for the same product/interval.
-- Keep the newest row before installing the historical-version constraint.
WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY "productId", "interval", "catalogVersion" ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC) AS row_number
  FROM "BillingPrice"
)
DELETE FROM "BillingPrice" price
USING duplicates
WHERE price.id = duplicates.id
  AND duplicates.row_number > 1;

CREATE INDEX IF NOT EXISTS "BillingProduct_active_type_idx"
  ON "BillingProduct" ("active", "type");

CREATE UNIQUE INDEX IF NOT EXISTS "BillingPrice_productId_interval_catalogVersion_key"
  ON "BillingPrice" ("productId", "interval", "catalogVersion");
