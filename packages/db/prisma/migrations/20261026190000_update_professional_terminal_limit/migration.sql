UPDATE "BillingPlan"
SET "metadata" = jsonb_set(
  COALESCE("metadata", '{}'::jsonb),
  '{maxTerminals}',
  '5'::jsonb,
  true
),
"updatedAt" = CURRENT_TIMESTAMP
WHERE "code" = 'PROFESSIONAL';
