-- Reconcile the persisted folio balance cache with the authoritative counters.
--
-- totalPayments includes advance deposits and payments used to settle charges.
-- FolioCreditApplication records the allocation of that money; subtracting
-- applications again produces false guest credit. This migration is
-- deliberately idempotent and only touches rows whose cached value differs.
UPDATE "Folio" AS folio
SET
  "balance" = folio."totalCharges" - folio."totalPayments",
  "version" = folio."version" + 1,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE folio."balance" IS DISTINCT FROM (folio."totalCharges" - folio."totalPayments");
