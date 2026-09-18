-- Unapplied corporate receipts are customer advances, not negative accounts
-- receivable. Keep them in a dedicated liability control account.
INSERT INTO "ChartOfAccount" (
  "id", "propertyId", "code", "name", "type", "category", "normalBalance",
  "description", "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  p."id",
  '2300',
  'Corporate Advances and Unapplied Receipts',
  'LIABILITY'::"AccountType",
  'Current Liabilities',
  'CREDIT'::"BalanceSide",
  'Corporate receipts received before invoice application or held as customer credit.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Property" p
WHERE NOT EXISTS (
  SELECT 1 FROM "ChartOfAccount" a
  WHERE a."propertyId" = p."id" AND a."code" = '2300'
);
