-- Cash in Transit is a distinct current asset between cashier custody and the
-- operating bank. It must not share POS Clearing, Bank Transfer Receivable,
-- or Cheques in Hand.
INSERT INTO "ChartOfAccount" (
  "id", "propertyId", "code", "name", "type", "category", "normalBalance",
  "description", "isActive", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  p."id",
  '1160',
  'Cash in Transit',
  'ASSET'::"AccountType",
  'Current Assets',
  'DEBIT'::"BalanceSide",
  'Cash transferred from cashier custody and awaiting bank clearance.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Property" p
WHERE NOT EXISTS (
  SELECT 1
  FROM "ChartOfAccount" a
  WHERE a."propertyId" = p."id"
    AND a."code" = '1160'
);

UPDATE "CashAccount" ca
SET
  "glAccountId" = coa."id",
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ChartOfAccount" coa
WHERE ca."propertyId" = coa."propertyId"
  AND ca."type" = 'CASH_IN_TRANSIT'
  AND ca."glAccountId" IS NULL
  AND coa."code" = '1160'
  AND coa."type" = 'ASSET';
