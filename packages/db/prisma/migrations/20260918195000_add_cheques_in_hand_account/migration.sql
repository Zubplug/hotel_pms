-- Cheques are held as a distinct clearing asset until deposited or cleared;
-- they must not be mixed with bank-transfer receivables.
INSERT INTO "ChartOfAccount" (
  "id", "propertyId", "code", "name", "type", "category", "normalBalance",
  "description", "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  p."id",
  '1150',
  'Cheques in Hand',
  'ASSET'::"AccountType",
  'Current Assets',
  'DEBIT'::"BalanceSide",
  'Cheques received and held pending bank deposit or clearance.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Property" p
WHERE NOT EXISTS (
  SELECT 1 FROM "ChartOfAccount" a
  WHERE a."propertyId" = p."id" AND a."code" = '1150'
);
