-- Smart Access is part of the PMS/front-desk workflow and is not a separately
-- billable add-on. Keep the legacy product for historical foreign keys, but
-- remove it from the active catalogue and preserve any old entitlement safely.

UPDATE "BillingProduct"
SET "active" = false,
    "updatedAt" = NOW()
WHERE "code" = 'ADDON_SMART_ACCESS';

-- Existing Smart Access entitlements are migrated to the PMS entitlement. If a
-- PMS entitlement already exists for the same scope, suspend the legacy row
-- instead of violating the unique scope key or creating duplicate access.
UPDATE "Entitlement" legacy
SET "status" = 'SUSPENDED',
    "suspendedAt" = COALESCE("suspendedAt", NOW()),
    "suspensionReason" = 'Smart Access is included in MODULE_PMS; legacy entitlement retired',
    "updatedAt" = NOW()
WHERE legacy."productCode" = 'ADDON_SMART_ACCESS'
  AND EXISTS (
    SELECT 1
    FROM "Entitlement" target
    WHERE target."organizationId" = legacy."organizationId"
      AND target."propertyId" IS NOT DISTINCT FROM legacy."propertyId"
      AND target."productCode" = 'MODULE_PMS'
  );

UPDATE "Entitlement" legacy
SET "productCode" = 'MODULE_PMS',
    "scopeKey" = legacy."organizationId" || ':' || COALESCE(legacy."propertyId"::text, '*') || ':MODULE_PMS',
    "metadata" = COALESCE(legacy."metadata", '{}'::jsonb) || jsonb_build_object('migratedFrom', 'ADDON_SMART_ACCESS'),
    "updatedAt" = NOW()
WHERE legacy."productCode" = 'ADDON_SMART_ACCESS'
  AND NOT EXISTS (
    SELECT 1
    FROM "Entitlement" target
    WHERE target."organizationId" = legacy."organizationId"
      AND target."propertyId" IS NOT DISTINCT FROM legacy."propertyId"
      AND target."productCode" = 'MODULE_PMS'
  );
