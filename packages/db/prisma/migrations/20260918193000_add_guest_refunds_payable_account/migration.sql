-- Dedicated liability control for guest credits transferred out of a folio.
-- This prevents refund obligations from being posted to City Ledger Receivable.
INSERT INTO "ChartOfAccount" (
  "id", "propertyId", "code", "name", "type", "category", "normalBalance",
  "description", "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(), p."id", '2160', 'Guest Refunds Payable', 'LIABILITY'::"AccountType",
  'Current Liabilities', 'CREDIT'::"BalanceSide",
  'Approved guest credits and refunds owed by the property.', true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Property" p
WHERE NOT EXISTS (
  SELECT 1 FROM "ChartOfAccount" existing
  WHERE existing."propertyId" = p."id" AND existing."code" = '2160'
);
