ALTER TABLE "CorporateContract"
  DROP CONSTRAINT IF EXISTS "CorporateContract_negotiationMinGuests_ck",
  DROP COLUMN IF EXISTS "negotiationMinGuests";
