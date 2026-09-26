-- Keep discounts and complimentary transactions on separate contra-revenue
-- accounts for every property. Existing accounts and journal history remain
-- untouched; this only guarantees the required accounts and settings.

INSERT INTO "ChartOfAccount" (
  "id", "propertyId", "code", "name", "type", "category", "normalBalance",
  "description", "isActive", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), p."id", '4900', 'Revenue Rebates and Discounts',
  'REVENUE'::"AccountType", 'Contra Revenue', 'DEBIT'::"BalanceSide",
  'Approved discounts and rebates reducing gross revenue.', true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Property" p
WHERE NOT EXISTS (
  SELECT 1 FROM "ChartOfAccount" a
  WHERE a."propertyId" = p."id" AND a."code" = '4900'
);

INSERT INTO "ChartOfAccount" (
  "id", "propertyId", "code", "name", "type", "category", "normalBalance",
  "description", "isActive", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), p."id", '4950', 'Complimentary Allowance',
  'REVENUE'::"AccountType", 'CONTRA_REVENUE', 'DEBIT'::"BalanceSide",
  'Complimentary goods and services provided without charge.', true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Property" p
WHERE NOT EXISTS (
  SELECT 1 FROM "ChartOfAccount" a
  WHERE a."propertyId" = p."id" AND a."code" = '4950'
);

UPDATE "Property"
SET "settings" = jsonb_set(
  jsonb_set(
    jsonb_set(COALESCE("settings", '{}'::jsonb), '{accountingConfig}',
      COALESCE("settings"->'accountingConfig', '{}'::jsonb), true),
    '{accountingConfig,contraRevenueAccounts,DISCOUNT}', '"4900"', true),
  '{accountingConfig,contraRevenueAccounts,COMPLIMENTARY}', '"4950"', true)
WHERE "settings" IS NULL
   OR COALESCE("settings"->'accountingConfig'->'contraRevenueAccounts'->>'DISCOUNT', '') <> '4900'
   OR COALESCE("settings"->'accountingConfig'->'contraRevenueAccounts'->>'COMPLIMENTARY', '') <> '4950';

-- 4250 is the canonical F&B revenue account used by POS and night audit.
UPDATE "Property"
SET "settings" = jsonb_set(
  jsonb_set(COALESCE("settings", '{}'::jsonb), '{accountingConfig,revenueAccounts,FOOD}', '"4250"', true),
  '{accountingConfig,revenueAccounts,BEVERAGE}', '"4250"', true)
WHERE COALESCE("settings"->'accountingConfig'->'revenueAccounts'->>'FOOD', '') <> '4250'
   OR COALESCE("settings"->'accountingConfig'->'revenueAccounts'->>'BEVERAGE', '') <> '4250';
