-- These catalogue entries are not production services yet. Retire them from
-- customer-facing catalogue queries while preserving their rows for history.
UPDATE "BillingProduct"
SET "active" = false,
    "updatedAt" = NOW()
WHERE "code" IN (
  'ADDON_GROWTH',
  'ADDON_GUEST_EXPERIENCE',
  'ADDON_INTELLIGENCE',
  'ADDON_ENTERPRISE_OPERATIONS'
);

-- Existing unsupported add-on entitlements must not continue granting access
-- after the products are retired. Historical rows remain auditable.
UPDATE "Entitlement"
SET "status" = 'SUSPENDED',
    "suspendedAt" = COALESCE("suspendedAt", NOW()),
    "suspensionReason" = 'Catalogue product retired pending runtime implementation',
    "updatedAt" = NOW()
WHERE "productCode" IN (
  'ADDON_GROWTH',
  'ADDON_GUEST_EXPERIENCE',
  'ADDON_INTELLIGENCE',
  'ADDON_ENTERPRISE_OPERATIONS'
)
  AND "status" = 'ACTIVE';
