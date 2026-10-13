-- Preserve complimentary guest amenity COGS and room contribution in each
-- immutable night-audit financial snapshot.
ALTER TABLE "NightAuditFinancialSnapshot"
  ADD COLUMN IF NOT EXISTS "guestAmenityCost" NUMERIC(18, 4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "netRoomContribution" NUMERIC(18, 4) NOT NULL DEFAULT 0;

-- Backfill historical snapshots from the immutable stock transactions already
-- posted for each property/business date.
UPDATE "NightAuditFinancialSnapshot" snapshot
SET "guestAmenityCost" = totals."amenityCost",
    "netRoomContribution" = snapshot."roomRevenue" - totals."amenityCost"
FROM (
  SELECT audit."id" AS "nightAuditId",
         COALESCE(SUM(ABS(transaction."totalValue")), 0) AS "amenityCost"
  FROM "NightAudit" audit
  LEFT JOIN "StockTransaction" transaction
    ON transaction."propertyId" = audit."propertyId"
   AND transaction."businessDate" = audit."businessDate"
   AND transaction."source" = 'GUEST_AMENITY'
  GROUP BY audit."id"
) totals
WHERE snapshot."nightAuditId" = totals."nightAuditId";
