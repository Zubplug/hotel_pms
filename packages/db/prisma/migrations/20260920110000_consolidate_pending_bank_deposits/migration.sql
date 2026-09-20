-- A received cash handover is an allocation into an open bank batch. Older
-- versions created one pending BankDeposit per handover, which made the
-- deposit register look like every handover was a separate bank submission.
-- Consolidate existing open batches per property into the oldest batch and
-- preserve every handover allocation and audit trail.

WITH ranked AS (
  SELECT
    d."id",
    d."propertyId",
    FIRST_VALUE(d."id") OVER (
      PARTITION BY d."propertyId"
      ORDER BY d."createdAt", d."id"
    ) AS "primaryId",
    SUM(d."expectedAmount") OVER (PARTITION BY d."propertyId") AS "totalExpected"
  FROM "BankDeposit" d
  WHERE d."status" = 'PENDING_HANDOVER'
), totals AS (
  SELECT DISTINCT "primaryId", "totalExpected"
  FROM ranked
)
UPDATE "BankDeposit" d
SET "expectedAmount" = totals."totalExpected",
    "notes" = COALESCE(d."notes", 'Consolidated open bank batch.')
FROM totals
WHERE d."id" = totals."primaryId";

WITH ranked AS (
  SELECT
    d."id",
    FIRST_VALUE(d."id") OVER (
      PARTITION BY d."propertyId"
      ORDER BY d."createdAt", d."id"
    ) AS "primaryId"
  FROM "BankDeposit" d
  WHERE d."status" = 'PENDING_HANDOVER'
)
UPDATE "BankDepositAllocation" allocation
SET "bankDepositId" = ranked."primaryId"
FROM ranked
WHERE allocation."bankDepositId" = ranked."id"
  AND ranked."id" <> ranked."primaryId";

WITH ranked AS (
  SELECT
    d."id",
    FIRST_VALUE(d."id") OVER (
      PARTITION BY d."propertyId"
      ORDER BY d."createdAt", d."id"
    ) AS "primaryId"
  FROM "BankDeposit" d
  WHERE d."status" = 'PENDING_HANDOVER'
)
DELETE FROM "BankDeposit" d
USING ranked
WHERE d."id" = ranked."id"
  AND ranked."id" <> ranked."primaryId";
