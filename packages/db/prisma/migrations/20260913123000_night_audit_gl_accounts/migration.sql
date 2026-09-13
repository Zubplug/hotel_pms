-- Account mappings required for controlled Night Audit journal posting.
-- Existing accounts are preserved; missing standard accounts are added per property.
INSERT INTO "ChartOfAccount" (
  "id", "propertyId", "code", "name", "type", "category", "normalBalance",
  "description", "isActive", "createdAt", "updatedAt"
)
SELECT gen_random_uuid(), p."id", a."code", a."name", a."type"::"AccountType",
  a."category", a."normalBalance"::"BalanceSide", a."description", true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Property" p
CROSS JOIN (VALUES
  ('1000', 'Cash on Hand', 'ASSET', 'Current Assets', 'DEBIT', 'Physical cash held by the property.'),
  ('1120', 'POS Clearing', 'ASSET', 'Current Assets', 'DEBIT', 'POS settlements pending transfer.'),
  ('1130', 'Bank Transfer Receivable', 'ASSET', 'Current Assets', 'DEBIT', 'Bank transfers pending confirmation.'),
  ('1140', 'City Ledger Receivable', 'ASSET', 'Current Assets', 'DEBIT', 'Amounts due from city-ledger accounts.'),
  ('2200', 'Tax Payable', 'LIABILITY', 'Current Liabilities', 'CREDIT', 'Taxes collected and payable.'),
  ('4050', 'Room Revenue', 'REVENUE', 'Operating Revenue', 'CREDIT', 'Accommodation revenue. Added only when a property has no existing Room Revenue account.'),
  ('4250', 'Food and Beverage Revenue', 'REVENUE', 'Operating Revenue', 'CREDIT', 'F&B and POS revenue. Added only when a property has no existing F&B account.'),
  ('4910', 'Refunds and Revenue Adjustments', 'REVENUE', 'Contra Revenue', 'DEBIT', 'Refunds and approved revenue adjustments.')
) AS a("code", "name", "type", "category", "normalBalance", "description")
WHERE NOT EXISTS (
  SELECT 1 FROM "ChartOfAccount" existing
  WHERE existing."propertyId" = p."id"
    AND (
      existing."code" = a."code"
      OR (a."code" = '1000' AND existing."name" ILIKE '%cash%')
      OR (a."code" = '1130' AND existing."name" ILIKE '%bank transfer%')
      OR (a."code" = '1140' AND existing."name" ILIKE '%city ledger%')
      OR (a."code" = '2200' AND (existing."name" ILIKE '%tax payable%' OR existing."name" ILIKE '%vat%'))
      OR (a."code" = '4050' AND existing."name" ILIKE '%room revenue%')
      OR (a."code" = '4250' AND existing."type" = 'REVENUE' AND (existing."name" ILIKE '%food%beverage%' OR existing."name" ILIKE '%f&b%'))
      OR (a."code" = '4910' AND existing."name" ILIKE '%refund%')
    )
);
