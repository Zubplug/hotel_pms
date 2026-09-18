-- 4100 is reserved for Recreation / Pool revenue in the standard PMS model.
-- Some legacy properties created it with an F&B label, which makes the
-- revenue control room display two F&B accounts and can confuse name-based
-- mappings. Only rename the legacy label; do not alter balances or postings.
UPDATE "ChartOfAccount"
SET
  "name" = 'Swimming Pool Revenue',
  "description" = 'Revenue generated from swimming pool passes and access',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = '4100'
  AND "type" = 'REVENUE'
  AND (
    "name" ILIKE '%food%beverage%'
    OR "name" ILIKE '%f&b%'
    OR "name" ILIKE '%f & b%'
  );
