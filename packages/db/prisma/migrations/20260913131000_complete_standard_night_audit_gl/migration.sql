-- Ensure every property has the canonical F&B revenue account.
-- Expense accounts with similar names must never satisfy this mapping.
INSERT INTO "ChartOfAccount" (
  "id", "propertyId", "code", "name", "type", "category", "normalBalance",
  "description", "isActive", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), p."id", '4250', 'Food and Beverage Revenue', 'REVENUE'::"AccountType",
  'Operating Revenue', 'CREDIT'::"BalanceSide",
  'F&B and POS revenue.', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Property" p
WHERE NOT EXISTS (
  SELECT 1 FROM "ChartOfAccount" existing
  WHERE existing."propertyId" = p."id" AND existing."code" = '4250'
);
