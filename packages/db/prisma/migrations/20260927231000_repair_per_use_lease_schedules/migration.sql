-- Backfill missing per-use billing periods for recurring leases created before
-- PER_USE billing generated one schedule per occurrence date.
WITH occurrence_lines AS (
  SELECT
    lc."id" AS "leaseContractId",
    lcs."id" AS "segmentId",
    ((eb."startTime" AT TIME ZONE p."timezone")::date) AS "periodDate",
    COUNT(*)::integer AS "usageCount",
    (COUNT(*) * lcs."rate")::numeric(18,4) AS "amount"
  FROM "LeaseContract" lc
  JOIN "Property" p ON p."id" = lc."propertyId"
  JOIN "EventBooking" eb ON eb."eventId" = lc."eventId" AND eb."status" <> 'CANCELLED'
  JOIN "LeaseContractSegment" lcs
    ON lcs."leaseContractId" = lc."id"
   AND lcs."hallId" = eb."hallId"
   AND lcs."startTime" = to_char(eb."startTime" AT TIME ZONE p."timezone", 'HH24:MI')
  WHERE lc."billingFrequency" = 'PER_USE'
    AND lc."eventId" IS NOT NULL
  GROUP BY lc."id", lcs."id", "periodDate", lcs."rate"
), schedule_totals AS (
  SELECT "leaseContractId", "periodDate", SUM("usageCount")::integer AS "usageCount", SUM("amount")::numeric(18,4) AS "amount"
  FROM occurrence_lines
  GROUP BY "leaseContractId", "periodDate"
)
INSERT INTO "LeaseBillingSchedule" ("id", "leaseContractId", "periodStart", "periodEnd", "dueDate", "usageCount", "amount", "status", "createdAt")
SELECT gen_random_uuid(), "leaseContractId", "periodDate", "periodDate", "periodDate", "usageCount", "amount", 'PENDING', NOW()
FROM schedule_totals st
WHERE NOT EXISTS (
  SELECT 1
  FROM "LeaseBillingSchedule" existing
  WHERE existing."leaseContractId" = st."leaseContractId"
    AND existing."periodStart" = st."periodDate"
    AND existing."periodEnd" = st."periodDate"
);

WITH occurrence_lines AS (
  SELECT
    lc."id" AS "leaseContractId",
    lcs."id" AS "segmentId",
    ((eb."startTime" AT TIME ZONE p."timezone")::date) AS "periodDate",
    COUNT(*)::integer AS "usageCount",
    (COUNT(*) * lcs."rate")::numeric(18,4) AS "amount"
  FROM "LeaseContract" lc
  JOIN "Property" p ON p."id" = lc."propertyId"
  JOIN "EventBooking" eb ON eb."eventId" = lc."eventId" AND eb."status" <> 'CANCELLED'
  JOIN "LeaseContractSegment" lcs
    ON lcs."leaseContractId" = lc."id"
   AND lcs."hallId" = eb."hallId"
   AND lcs."startTime" = to_char(eb."startTime" AT TIME ZONE p."timezone", 'HH24:MI')
  WHERE lc."billingFrequency" = 'PER_USE'
    AND lc."eventId" IS NOT NULL
  GROUP BY lc."id", lcs."id", "periodDate", lcs."rate"
)
INSERT INTO "LeaseBillingScheduleLine" ("id", "scheduleId", "segmentId", "usageCount", "amount")
SELECT gen_random_uuid(), schedule."id", lines."segmentId", lines."usageCount", lines."amount"
FROM occurrence_lines lines
JOIN "LeaseBillingSchedule" schedule
  ON schedule."leaseContractId" = lines."leaseContractId"
 AND schedule."periodStart" = lines."periodDate"
 AND schedule."periodEnd" = lines."periodDate"
WHERE NOT EXISTS (
  SELECT 1
  FROM "LeaseBillingScheduleLine" existing
  WHERE existing."scheduleId" = schedule."id"
    AND existing."segmentId" = lines."segmentId"
);
