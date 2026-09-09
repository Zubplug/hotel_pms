-- Corporate reservations are charged to the corporate city ledger and do not
-- require an individual guest deposit.
ALTER TABLE "CorporateAccount"
  ALTER COLUMN "depositPolicy" SET DEFAULT 'WAIVED';

UPDATE "CorporateAccount"
SET "depositPolicy" = 'WAIVED'
WHERE "depositPolicy" IS DISTINCT FROM 'WAIVED';
