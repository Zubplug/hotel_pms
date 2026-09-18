-- Keep allocation records compatible with folio-level city-ledger credit
-- application. The column is nullable for existing invoice allocations.
ALTER TABLE "CityLedgerAllocation"
  ADD COLUMN IF NOT EXISTS "folioId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CityLedgerAllocation_folioId_fkey'
  ) THEN
    ALTER TABLE "CityLedgerAllocation"
      ADD CONSTRAINT "CityLedgerAllocation_folioId_fkey"
      FOREIGN KEY ("folioId") REFERENCES "Folio"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CityLedgerAllocation_folioId_idx"
  ON "CityLedgerAllocation"("folioId");
